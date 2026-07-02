#!/usr/bin/env python3
"""Backfill the Puritan search-token data that the DigitalOcean→Cloudflare
migration missed.

Incident: after the app moved onto the Cloudflare backend, Puritan search was
"missing so many links and references". Cause: the migration copied
`puritan_works` / `puritan_authors` but not the two tables the search feature
depends on — `search_tokens` (the highlightable terms, 444 of them) had only 5
rows, and `puritan_work_tokens` (the token→work junction, curated by match_count)
was empty. `puritan_works_fts` was also absent on prod. So:
  - the reader highlighted ~5 terms instead of 444, and
  - tapping a term returned little/nothing (the LIKE fallback misses multi-word
    tokens because `content` was also truncated to 2000 chars in the migration).

The DigitalOcean service still serves the full data at public endpoints, so this
script rebuilds the two token tables on a Cloudflare D1 from DO:
  1. GET  /api/puritan/tokens                -> search_tokens (id/token/source_key)
  2. POST /api/puritan/search {token}        -> top-20 works per token; map each
     DO work title to the Cloudflare work id -> puritan_work_tokens junction.

Usage:
    python3 scripts/backfill_puritan_tokens_from_do.py --db parable-db
    python3 scripts/backfill_puritan_tokens_from_do.py --db parable-db-test

Prereqs: `wrangler` authenticated; the target D1 already has puritan_works /
puritan_authors populated (copy them from prod with
`wrangler d1 export parable-db --remote --table puritan_works --no-schema ...`
then import, if the DB is empty — e.g. a fresh test DB).
"""

import argparse
import json
import subprocess
import sys
import urllib.request
import uuid
import concurrent.futures as futures

DO = "https://parable-service-9mbah.ondigitalocean.app"


def do_get(path, body=None):
    url = DO + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    return json.load(urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=40))


def d1(db, sql, file=False):
    cmd = ["npx", "wrangler", "d1", "execute", db, "--remote"]
    cmd += (["--file", sql] if file else ["--command", sql])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"d1 failed: {r.stderr[-500:]}")
    return r.stdout


def d1_json(db, sql):
    out = subprocess.run(
        ["npx", "wrangler", "d1", "execute", db, "--remote", "--json", "--command", sql],
        capture_output=True, text=True).stdout
    raw = json.loads(out)
    return (raw[0] if isinstance(raw, list) else raw["result"][0])["results"]


def esc(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    args = ap.parse_args()
    db = args.db

    # 1. search_tokens
    tokens = do_get("/api/puritan/tokens")["tokens"]
    print(f"DO tokens: {len(tokens)}")
    stmts = ["DELETE FROM puritan_work_tokens;", "DELETE FROM search_tokens;"]
    for i in range(0, len(tokens), 100):
        vals = ",".join(
            f"({esc(t['id'])},{esc(t['token'])},{esc(t.get('source_key'))},{esc(t['created_at'])})"
            for t in tokens[i:i + 100])
        stmts.append(f"INSERT INTO search_tokens (id, token, source_key, created_at) VALUES {vals};")
    open("/tmp/_tokens.sql", "w").write("\n".join(stmts) + "\n")
    d1(db, "/tmp/_tokens.sql", file=True)
    print("search_tokens loaded")

    # 2. junction — map DO work titles to CF work ids
    title_map = {}
    for r in d1_json(db, "SELECT id, title FROM puritan_works;"):
        title_map.setdefault(r["title"], r["id"])
    print(f"CF works: {len(title_map)} unique titles")

    def fetch(t):
        try:
            return t, do_get("/api/puritan/search", {"token": t["token"]}).get("results", [])
        except Exception:
            return t, None

    rows = []
    with futures.ThreadPoolExecutor(max_workers=12) as ex:
        for t, res in ex.map(fetch, tokens):
            for r in (res or []):
                wid = title_map.get(r.get("title"))
                if wid:
                    rows.append((str(uuid.uuid4()), wid, t["id"],
                                 int(r.get("match_count") or 0), r.get("snippet")))
    print(f"junction rows: {len(rows)}")
    stmts = ["DELETE FROM puritan_work_tokens;"]
    for i in range(0, len(rows), 80):
        vals = ",".join(
            f"({esc(a)},{esc(b)},{esc(c)},{d},{esc(e)})" for a, b, c, d, e in rows[i:i + 80])
        stmts.append(f"INSERT INTO puritan_work_tokens (id, work_id, token_id, match_count, snippet) VALUES {vals};")
    open("/tmp/_junction.sql", "w").write("\n".join(stmts) + "\n")
    d1(db, "/tmp/_junction.sql", file=True)
    print("puritan_work_tokens loaded")


if __name__ == "__main__":
    main()
