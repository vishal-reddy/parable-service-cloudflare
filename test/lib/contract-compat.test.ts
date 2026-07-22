import { describe, it, expect } from "vitest";
import {
  legacyCompatEnabled,
  legacyWorkFields,
  scrubSourcePaths,
  toLegacySearchResult,
  type SearchRow,
} from "../../src/lib/contract-compat";

describe("legacyCompatEnabled", () => {
  it("defaults ON when unset", () => {
    expect(legacyCompatEnabled({})).toBe(true);
    expect(legacyCompatEnabled({ LEGACY_CONTRACT_COMPAT: undefined })).toBe(true);
  });

  it("is ON for 'on'/'true' and tolerates case + whitespace", () => {
    expect(legacyCompatEnabled({ LEGACY_CONTRACT_COMPAT: "on" })).toBe(true);
    expect(legacyCompatEnabled({ LEGACY_CONTRACT_COMPAT: " ON " })).toBe(true);
    expect(legacyCompatEnabled({ LEGACY_CONTRACT_COMPAT: "true" })).toBe(true);
  });

  it("is OFF only for explicit disable values", () => {
    for (const v of ["off", "false", "0", "no", "OFF"]) {
      expect(legacyCompatEnabled({ LEGACY_CONTRACT_COMPAT: v })).toBe(false);
    }
  });
});

describe("scrubSourcePaths", () => {
  it("returns '' for null/undefined/empty", () => {
    expect(scrubSourcePaths(null)).toBe("");
    expect(scrubSourcePaths(undefined)).toBe("");
    expect(scrubSourcePaths("")).toBe("");
  });

  it("strips source-path, TODO status, and checklist noise", () => {
    const raw = [
      "Source DOCX: `A/Owen_John/Some Work.docx`",
      "Status: TODO manual conversion and theological proofread.",
      "## Conversion Checklist",
      "- item one",
      "- item two",
      "",
      "Real prose begins here.",
    ].join("\n");
    const out = scrubSourcePaths(raw);
    expect(out).toBe("Real prose begins here.");
  });

  it("is a no-op on already-clean prose", () => {
    expect(scrubSourcePaths("Of the Mortification of Sin.")).toBe(
      "Of the Mortification of Sin.",
    );
  });
});

describe("toLegacySearchResult", () => {
  const base: SearchRow = {
    work_id: "w1",
    title: "A Work",
    file_path: "A/x.md",
    author: "John Owen",
    years: "1616-1683",
    match_count: 3,
    snippet: "…of Holy Scripture…",
  };

  it("passes clean rows through, preserving extra keys", () => {
    const out = toLegacySearchResult(base);
    expect(out.author).toBe("John Owen");
    expect(out.snippet).toBe("…of Holy Scripture…");
    expect(out.match_count).toBe(3);
    expect(out.file_path).toBe("A/x.md"); // extra key preserved
  });

  it("coalesces a NULL snippet to '' (the 1.0.0-breaking case)", () => {
    const out = toLegacySearchResult({ ...base, snippet: null });
    expect(out.snippet).toBe("");
    expect(typeof out.snippet).toBe("string");
  });

  it("coalesces null author/match_count to safe non-null values", () => {
    const out = toLegacySearchResult({ ...base, author: null, match_count: null });
    expect(out.author).toBe("");
    expect(out.match_count).toBe(0);
  });
});

describe("legacyWorkFields", () => {
  it("flattens author name + years", () => {
    expect(legacyWorkFields({ name: "John Owen", years: "1616-1683" })).toEqual({
      author_name: "John Owen",
      years: "1616-1683",
    });
  });

  it("nulls missing author gracefully", () => {
    expect(legacyWorkFields(null)).toEqual({ author_name: null, years: null });
    expect(legacyWorkFields({ name: "X" })).toEqual({
      author_name: "X",
      years: null,
    });
  });
});
