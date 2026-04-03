#!/usr/bin/env node

/**
 * Bulk import Puritan Library content into Cloudflare D1 via the Worker's
 * /admin/import endpoint (uses D1 bound params — no SQL statement size limit).
 *
 * Usage:
 *   node scripts/import-puritan-library.mjs <library-path> [--execute] [--remote]
 */

import { readdir, readFile, stat, open as fsOpen } from "node:fs/promises";
import { join, basename, relative } from "node:path";

const LIBRARY_PATH = process.argv[2] || "../parable-service/PuritanLibrary";
const EXECUTE = process.argv.includes("--execute");

const WORKER_URL = "https://parable.kecker.co";
const IMPORT_SECRET = "puritan-import-2026";
const MAX_CONTENT_SIZE = 50 * 1024 * 1024; // read files up to 50MB
const CONTENT_PREVIEW_SIZE = 2000; // store first 2000 chars in D1
const BATCH_SIZE = 1; // 1 work per HTTP request
const CONCURRENCY = 10; // parallel HTTP requests

function parseAuthorDir(dirName) {
  const match = dirName.match(/^(.+?)\s*-\s*(.+)$/);
  if (match) {
    const years = match[2].trim();
    const parts = match[1].split("_").filter(Boolean);
    const name =
      parts.length >= 2
        ? parts.slice(1).join(" ") + " " + parts[0]
        : match[1].replace(/_/g, " ").trim();
    return { name: name.trim(), years: years === "unknown" ? null : years };
  }
  return { name: dirName.replace(/_/g, " "), years: null };
}

async function scanLibrary(libraryPath) {
  const authors = new Map();
  const letters = await readdir(libraryPath);

  for (const letter of letters.sort()) {
    const letterPath = join(libraryPath, letter);
    let authorDirs;
    try { authorDirs = await readdir(letterPath); } catch { continue; }

    for (const authorDir of authorDirs.sort()) {
      const authorPath = join(letterPath, authorDir);
      let files;
      try { files = await readdir(authorPath); } catch { continue; }

      if (!authors.has(authorDir)) {
        authors.set(authorDir, { ...parseAuthorDir(authorDir), works: [] });
      }

      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        const filePath = join(authorPath, f);
        const relPath = relative(libraryPath, filePath);
        authors.get(authorDir).works.push({ title: basename(f, ".md"), filePath, relPath });
      }
    }
  }
  return authors;
}

async function postImport(body) {
  const res = await fetch(`${WORKER_URL}/admin/import`, {
    method: "POST",
    headers: {
      "X-Import-Secret": IMPORT_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function ensureAuthors(authors) {
  // Query existing authors
  const existing = await postImport({ action: "query", sql: "SELECT id, name FROM puritan_authors" });
  const nameToId = new Map();
  for (const a of existing.results || []) nameToId.set(a.name, a.id);

  const authorIdMap = new Map();
  const toInsert = [];

  for (const [dirName, author] of authors) {
    const existingId = nameToId.get(author.name);
    if (existingId) {
      authorIdMap.set(dirName, existingId);
    } else {
      const id = crypto.randomUUID();
      authorIdMap.set(dirName, id);
      toInsert.push({ id, name: author.name, years: author.years });
    }
  }

  if (toInsert.length > 0) {
    console.log(`  Inserting ${toInsert.length} new authors...`);
    for (let i = 0; i < toInsert.length; i += 50) {
      await postImport({ action: "import-authors", authors: toInsert.slice(i, i + 50) });
    }
  }
  console.log(`  ${authorIdMap.size} authors mapped ✓`);
  return authorIdMap;
}

async function main() {
  console.log(`Scanning: ${LIBRARY_PATH}`);
  console.log(`Execute: ${EXECUTE}\n`);

  const authors = await scanLibrary(LIBRARY_PATH);
  let totalWorks = 0;
  for (const [, a] of authors) totalWorks += a.works.length;
  console.log(`Found ${authors.size} authors, ${totalWorks} works\n`);

  if (!EXECUTE) {
    let small = 0, medium = 0, large = 0, huge = 0;
    for (const [, author] of authors) {
      for (const work of author.works) {
        try {
          const s = await stat(work.filePath);
          if (s.size < 100 * 1024) small++;
          else if (s.size < 1024 * 1024) medium++;
          else if (s.size < MAX_CONTENT_SIZE) large++;
          else huge++;
        } catch { /* skip */ }
      }
    }
    console.log("Size distribution:");
    console.log(`  < 100KB:  ${small}`);
    console.log(`  100KB-1MB: ${medium}`);
    console.log(`  1MB-9MB:  ${large}`);
    console.log(`  > 9MB:    ${huge} (will skip)`);
    console.log("\nRun with --execute to import to production D1");
    return;
  }

  // Test connectivity
  console.log("Testing worker connectivity...");
  await postImport({ action: "query", sql: "SELECT 1" });
  console.log("Worker reachable ✓\n");

  // Clear data and import authors with fresh IDs
  console.log("Setting up authors...");
  const authorIdMap = await ensureAuthors(authors);

  // Collect all works
  console.log("Reading works from disk...");
  const allWorks = [];
  let skipped = 0, oversized = 0;

  for (const [dirName, author] of authors) {
    const authorId = authorIdMap.get(dirName);
    for (const work of author.works) {
      try {
        const fstat = await stat(work.filePath);
        // Read only the preview portion to avoid OOM on large files
        const fh = await fsOpen(work.filePath, "r");
        const buf = Buffer.alloc(Math.min(CONTENT_PREVIEW_SIZE * 4, fstat.size)); // 4x for UTF-8 multibyte
        await fh.read(buf, 0, buf.length, 0);
        await fh.close();
        const preview = buf.toString("utf-8").slice(0, CONTENT_PREVIEW_SIZE);
        allWorks.push({
          id: crypto.randomUUID(),
          authorId,
          title: work.title,
          content: preview,
          filePath: work.relPath,
        });
      } catch { skipped++; }
    }
  }
  console.log(`  ${allWorks.length} works to import (${skipped} unreadable, ${oversized} oversized)\n`);

  // Import works in batches with concurrency
  console.log("Importing works...");
  let imported = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < allWorks.length; i += BATCH_SIZE * CONCURRENCY) {
    const chunk = allWorks.slice(i, i + BATCH_SIZE * CONCURRENCY);
    // Split chunk into CONCURRENCY groups
    const groups = [];
    for (let j = 0; j < chunk.length; j += BATCH_SIZE) {
      groups.push(chunk.slice(j, j + BATCH_SIZE));
    }

    const results = await Promise.all(
      groups.map(async (group) => {
        try {
          return await postImport({ works: group });
        } catch (err) {
          // If the batch fails, try one at a time
          let batchImported = 0, batchFailed = 0;
          const batchErrors = [];
          for (const w of group) {
            try {
              await postImport({ works: [w] });
              batchImported++;
            } catch (e) {
              batchFailed++;
              batchErrors.push(`${w.title}: ${e.message.slice(0, 80)}`);
            }
          }
          return { imported: batchImported, failed: batchFailed, errors: batchErrors };
        }
      })
    );

    for (const r of results) {
      imported += r.imported || 0;
      failed += r.failed || 0;
      if (r.errors?.length) errors.push(...r.errors);
    }

    process.stdout.write(
      `\r  Progress: ${imported + failed}/${allWorks.length} (${imported} ok, ${failed} fail)   `
    );
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Skipped:  ${skipped} unreadable, ${oversized} oversized`);
  if (errors.length) {
    console.log(`\n  First ${Math.min(errors.length, 20)} errors:`);
    for (const e of errors.slice(0, 20)) console.log(`    ${e}`);
  }
}

main().catch(console.error);
