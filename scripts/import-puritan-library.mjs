#!/usr/bin/env node

/**
 * Bulk import Puritan Library content into Cloudflare D1.
 *
 * Reads markdown files from the PuritanLibrary directory, extracts author
 * metadata from folder names, and generates batched SQL files for D1 import.
 *
 * Usage:
 *   node scripts/import-puritan-library.mjs <library-path> [--execute]
 *
 * Options:
 *   --execute   Run wrangler d1 execute for each batch (otherwise just generates SQL)
 *   --remote    Target remote D1 (default: local)
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename, relative } from "node:path";
import { execSync } from "node:child_process";

const LIBRARY_PATH = process.argv[2] || "../parable-service/PuritanLibrary";
const EXECUTE = process.argv.includes("--execute");
const REMOTE = process.argv.includes("--remote");
const BATCH_DIR = "scripts/batches";
const MAX_BATCH_SIZE = 4 * 1024 * 1024; // 4MB per batch file (D1 safe limit)

function escapeSql(str) {
  if (!str) return "NULL";
  return "'" + str.replace(/'/g, "''") + "'";
}

function parseAuthorDir(dirName) {
  // Format: "AuthorLast_First - Years" e.g. "Bunyan_John - 1628-1688"
  const match = dirName.match(/^(.+?)\s*-\s*(.+)$/);
  if (match) {
    const nameParts = match[1].replace(/_/g, " ").trim();
    const years = match[2].trim();
    // Convert "Last First" to "First Last" if underscore-separated
    const parts = match[1].split("_").filter(Boolean);
    const name =
      parts.length >= 2
        ? parts.slice(1).join(" ") + " " + parts[0]
        : nameParts;
    return { name: name.trim(), years: years === "unknown" ? null : years };
  }
  return { name: dirName.replace(/_/g, " "), years: null };
}

async function scanLibrary(libraryPath) {
  const authors = new Map(); // authorDirName -> { name, years, works: [] }
  const letters = await readdir(libraryPath);

  for (const letter of letters.sort()) {
    const letterPath = join(libraryPath, letter);
    let authorDirs;
    try {
      authorDirs = await readdir(letterPath);
    } catch {
      continue;
    }

    for (const authorDir of authorDirs.sort()) {
      const authorPath = join(letterPath, authorDir);
      let files;
      try {
        files = await readdir(authorPath);
      } catch {
        continue;
      }

      if (!authors.has(authorDir)) {
        const parsed = parseAuthorDir(authorDir);
        authors.set(authorDir, { ...parsed, works: [] });
      }

      const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
      for (const mdFile of mdFiles) {
        const filePath = join(authorPath, mdFile);
        const relPath = relative(libraryPath, filePath);
        const title = basename(mdFile, ".md");
        authors.get(authorDir).works.push({ title, filePath, relPath });
      }
    }
  }

  return authors;
}

async function generateBatches(authors) {
  await mkdir(BATCH_DIR, { recursive: true });

  let batchNum = 0;
  let currentBatch = "";
  let currentSize = 0;
  let totalAuthors = 0;
  let totalWorks = 0;
  let authorIdMap = new Map();
  const batches = [];

  // First pass: generate author inserts
  let authorSql = "-- Authors\n";
  for (const [dirName, author] of authors) {
    const authorId = crypto.randomUUID();
    authorIdMap.set(dirName, authorId);
    authorSql += `INSERT OR IGNORE INTO puritan_authors (id, name, years, created_at) VALUES (${escapeSql(authorId)}, ${escapeSql(author.name)}, ${escapeSql(author.years)}, datetime('now'));\n`;
    totalAuthors++;
  }

  // Write authors as first batch
  const authorBatchFile = join(BATCH_DIR, `batch_000_authors.sql`);
  await writeFile(authorBatchFile, authorSql);
  batches.push(authorBatchFile);
  console.log(
    `Batch 000: ${totalAuthors} authors (${(authorSql.length / 1024).toFixed(1)} KB)`
  );

  // Second pass: generate work inserts in batches
  for (const [dirName, author] of authors) {
    const authorId = authorIdMap.get(dirName);

    for (const work of author.works) {
      let content;
      try {
        content = await readFile(work.filePath, "utf-8");
      } catch (err) {
        console.error(`  Skip: ${work.relPath} (${err.message})`);
        continue;
      }

      const workId = crypto.randomUUID();
      const sql = `INSERT OR IGNORE INTO puritan_works (id, author_id, title, content, file_path, created_at) VALUES (${escapeSql(workId)}, ${escapeSql(authorId)}, ${escapeSql(work.title)}, ${escapeSql(content)}, ${escapeSql(work.relPath)}, datetime('now'));\n`;

      if (currentSize + sql.length > MAX_BATCH_SIZE && currentBatch.length > 0) {
        batchNum++;
        const batchFile = join(
          BATCH_DIR,
          `batch_${String(batchNum).padStart(3, "0")}_works.sql`
        );
        await writeFile(batchFile, currentBatch);
        batches.push(batchFile);
        console.log(
          `Batch ${String(batchNum).padStart(3, "0")}: ${(currentSize / 1024 / 1024).toFixed(1)} MB`
        );
        currentBatch = "";
        currentSize = 0;
      }

      currentBatch += sql;
      currentSize += sql.length;
      totalWorks++;
    }
  }

  // Write final batch
  if (currentBatch.length > 0) {
    batchNum++;
    const batchFile = join(
      BATCH_DIR,
      `batch_${String(batchNum).padStart(3, "0")}_works.sql`
    );
    await writeFile(batchFile, currentBatch);
    batches.push(batchFile);
    console.log(
      `Batch ${String(batchNum).padStart(3, "0")}: ${(currentSize / 1024 / 1024).toFixed(1)} MB`
    );
  }

  console.log(
    `\nTotal: ${totalAuthors} authors, ${totalWorks} works in ${batches.length} batches`
  );
  return batches;
}

async function executeBatches(batches) {
  const remoteFlag = REMOTE ? "--remote" : "--local";

  // Clear existing puritan data first
  console.log("\nClearing existing puritan data...");
  execSync(
    `echo "DELETE FROM puritan_work_tokens; DELETE FROM puritan_works; DELETE FROM puritan_authors;" | npx wrangler d1 execute parable-db ${remoteFlag} --command "DELETE FROM puritan_work_tokens;" --yes`,
    { stdio: "inherit" }
  );

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `\nExecuting batch ${i + 1}/${batches.length}: ${basename(batch)}`
    );
    try {
      execSync(
        `npx wrangler d1 execute parable-db ${remoteFlag} --file=${batch} --yes`,
        { stdio: "inherit" }
      );
    } catch (err) {
      console.error(`  FAILED: ${batch} — ${err.message}`);
      console.error("  Continuing with next batch...");
    }
  }
}

async function main() {
  console.log(`Scanning: ${LIBRARY_PATH}`);
  console.log(`Execute: ${EXECUTE}, Remote: ${REMOTE}\n`);

  const authors = await scanLibrary(LIBRARY_PATH);
  const batches = await generateBatches(authors);

  if (EXECUTE) {
    await executeBatches(batches);
    console.log("\n✅ Import complete!");
  } else {
    console.log(
      `\nGenerated ${batches.length} batch files in ${BATCH_DIR}/`
    );
    console.log("Run with --execute to apply to D1");
    console.log("Add --remote to target production D1");
  }
}

main().catch(console.error);
