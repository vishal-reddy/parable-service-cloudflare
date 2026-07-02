#!/usr/bin/env python3
"""Recover DO work ids for works whose author /works endpoint OOMs.

DO's /authors/:id/works loads full content and OOMs for prolific authors (Prynne,
Baxter, ...), so ~2.4k CF works couldn't be mapped. DO's token search, however, is
lightweight (returns snippets, not full content) and reaches those works if they
match any of the 444 tokens. This paginates search across all tokens to build a
title -> DO id map, then fills in the still-unmapped CF works and appends them to
/tmp/content_map.json.
"""
import json, subprocess, urllib.request, concurrent.futures as cf

DO = "https://parable-service-9mbah.ondigitalocean.app/api/puritan"


def post(path, body):
    return json.load(urllib.request.urlopen(urllib.request.Request(
        DO + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}), timeout=40))


def d1_all(sql):
    out = subprocess.run(["npx", "wrangler", "d1", "execute", "parable-db", "--remote",
                          "--json", "--command", sql], capture_output=True, text=True).stdout
    raw = json.loads(out)
    return (raw[0] if isinstance(raw, list) else raw["result"][0])["results"]


def main():
    tokens = [t["token"] for t in json.load(open("/tmp/do_tokens.json"))["tokens"]]
    mapped = json.load(open("/tmp/content_map.json"))
    mapped_paths = {p["file_path"] for p in mapped}

    cf_works = d1_all("SELECT title, file_path FROM puritan_works WHERE file_path IS NOT NULL;")
    unmapped = [w for w in cf_works if w["file_path"] not in mapped_paths]
    print(f"currently unmapped CF works: {len(unmapped)}")

    # paginate search across all tokens -> title -> do_id
    title_to_do = {}

    def crawl(tok):
        found = {}
        off = 0
        while True:
            try:
                res = post(f"/search?limit=100&offset={off}", {"token": tok})
            except Exception:
                # DO search takes query params on the URL; fall back to body-less pages
                try:
                    res = post("/search", {"token": tok})
                except Exception:
                    break
            r = res.get("results", [])
            for x in r:
                found[(x.get("title") or "").strip().lower()] = x.get("work_id")
            if len(r) < 100:
                break
            off += 100
            if off > 2000:
                break
        return found

    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for d in ex.map(crawl, tokens):
            title_to_do.update(d)
    print(f"search-reachable DO titles: {len(title_to_do)}")

    added = 0
    for w in unmapped:
        do_id = title_to_do.get((w.get("title") or "").strip().lower())
        if do_id:
            mapped.append({"file_path": w["file_path"], "do_work_id": do_id})
            added += 1
    json.dump(mapped, open("/tmp/content_map.json", "w"))
    print(f"recovered: {added}  total_mapped_now: {len(mapped)}  still_unmapped: {len(unmapped)-added}")


if __name__ == "__main__":
    main()
