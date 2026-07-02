#!/usr/bin/env python3
"""Drive the R2 full-content ingest.

Reads /tmp/content_map.json ([{file_path, do_work_id}, ...]) and POSTs each to the
worker's secret-gated /api/puritan/admin/ingest. The worker fetches the full text
from DigitalOcean and writes it to the shared R2 bucket server-side, so the 12 GB
never touches this machine and one run populates BOTH environments (shared bucket).

Usage: python3 scripts/run_content_ingest.py <host> <secret> [--retry-only]
  host   e.g. https://parable.kecker.co
"""
import json, sys, urllib.request, urllib.error, concurrent.futures as cf, time

host = sys.argv[1].rstrip("/")
secret = sys.argv[2]
pairs = json.load(open("/tmp/content_map.json"))

done_file = "/tmp/ingest_done.json"
try:
    done = set(json.load(open(done_file)))
except Exception:
    done = set()

todo = [p for p in pairs if p["file_path"] not in done]
print(f"pairs={len(pairs)} already_done={len(done)} todo={len(todo)}", flush=True)

ok = 0
fail = []
lock_done = list(done)


def ingest(p):
    body = json.dumps({"file_path": p["file_path"], "do_work_id": p["do_work_id"]}).encode()
    req = urllib.request.Request(host + "/api/puritan/admin/ingest", data=body,
                                 headers={"Content-Type": "application/json",
                                          "X-Migration-Secret": secret,
                                          # Cloudflare bot-blocks the default Python UA.
                                          "User-Agent": "curl/8.0"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=120))
        return p, r.get("ok", False), r.get("bytes", 0)
    except Exception as e:
        return p, False, str(e)[:80]


t0 = time.time()
with cf.ThreadPoolExecutor(max_workers=24) as ex:
    for i, (p, good, info) in enumerate(ex.map(ingest, todo), 1):
        if good:
            ok += 1; lock_done.append(p["file_path"])
        else:
            fail.append((p["file_path"], info))
        if i % 250 == 0:
            json.dump(lock_done, open(done_file, "w"))
            print(f"  {i}/{len(todo)} ok={ok} fail={len(fail)} ({time.time()-t0:.0f}s)", flush=True)

json.dump(lock_done, open(done_file, "w"))
print(f"DONE ok={ok} fail={len(fail)} total_done={len(lock_done)}/{len(pairs)}", flush=True)
if fail:
    print("sample failures:", fail[:5], flush=True)
