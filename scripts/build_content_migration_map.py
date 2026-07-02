#!/usr/bin/env python3
"""Build the DO->CF work mapping for the R2 full-content migration.

DigitalOcean has each work's full text (D1 only kept a 2 KB snippet). DO has no
works-list endpoint, but exposes /authors/:id/works, so we enumerate works by
iterating the ~1053 authors. Cloudflare works carry a `file_path` (the R2 key)
and a title; we map CF (author, title) -> DO work id so the ingest endpoint can
pull the full text server-side into R2.

Output: /tmp/content_map.json = [ {file_path, do_work_id}, ... ]
"""
import json, subprocess, urllib.request, concurrent.futures as cf

DO = "https://parable-service-9mbah.ondigitalocean.app/api/puritan"


def get(url):
    return json.load(urllib.request.urlopen(url, timeout=40))


def d1_all(sql):
    out = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "parable-db", "--remote", "--json", "--command", sql],
        capture_output=True, text=True).stdout
    raw = json.loads(out)
    return (raw[0] if isinstance(raw, list) else raw["result"][0])["results"]


def main():
    # 1. enumerate DO works via authors
    authors = get(f"{DO}/authors")["authors"]
    print(f"DO authors: {len(authors)}")

    do_by_key = {}   # (author_lower, title_lower) -> do_id
    do_by_title = {} # title_lower -> do_id (fallback)

    def fetch_author(a):
        try:
            return a, get(f"{DO}/authors/{a['id']}/works").get("works", [])
        except Exception:
            return a, None

    total = 0
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for a, works in ex.map(fetch_author, authors):
            for w in (works or []):
                total += 1
                t = (w.get("title") or "").strip().lower()
                do_by_key[(a["name"].strip().lower(), t)] = w["id"]
                do_by_title.setdefault(t, w["id"])
    print(f"DO works enumerated: {total}  (unique titles {len(do_by_title)})")

    # 2. CF works + authors
    cf_authors = {r["id"]: r["name"] for r in d1_all("SELECT id, name FROM puritan_authors;")}
    cf_works = d1_all("SELECT id, title, file_path, author_id FROM puritan_works;")
    print(f"CF works: {len(cf_works)}")

    # 3. map
    pairs, miss = [], 0
    for w in cf_works:
        if not w.get("file_path"):
            miss += 1; continue
        t = (w.get("title") or "").strip().lower()
        aname = (cf_authors.get(w["author_id"], "") or "").strip().lower()
        do_id = do_by_key.get((aname, t)) or do_by_title.get(t)
        if do_id:
            pairs.append({"file_path": w["file_path"], "do_work_id": do_id})
        else:
            miss += 1
    json.dump(pairs, open("/tmp/content_map.json", "w"))
    print(f"mapped pairs: {len(pairs)}  unmapped: {miss}")


if __name__ == "__main__":
    main()
