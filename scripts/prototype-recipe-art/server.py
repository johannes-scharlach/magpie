# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy", "pillow", "rembg[cpu]==2.0.85"]
# ///
"""PROTOTYPE, throwaway. POST an image to /matte, get finished WebP art back.

Reuses process_image from scripts/art-matting.py unchanged, then crops and
exports like the asset scripts (alpha > 10, 16px padding, 512px, q82).
Timings and peak memory go to the response headers and stdout.

    uv run scripts/prototype-recipe-art/server.py
"""

import importlib.util
import io
import os
import resource
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location(
    "art_matting", Path(__file__).parent.parent / "art-matting.py"
)
art_matting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art_matting)


def peak_mb() -> float:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return rss / 1024 / 1024 if sys.platform == "darwin" else rss / 1024


t = time.perf_counter()
session = new_session("isnet-general-use")
print(f"model loaded in {time.perf_counter() - t:.2f}s, peak {peak_mb():.0f} MB", flush=True)


def finish(cutout: Image.Image) -> bytes:
    bbox = cutout.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        w, h = cutout.size
        cutout = cutout.crop((max(0, l - 16), max(0, t - 16), min(w, r + 16), min(h, b + 16)))
    cutout.thumbnail((512, 512))
    out = io.BytesIO()
    cutout.save(out, format="WEBP", quality=82, alpha_quality=100, method=6)
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers["content-length"]))
        t0 = time.perf_counter()
        image = Image.open(io.BytesIO(body)).convert("RGB")
        size = int(os.environ.get("MATTE_SIZE", "0"))
        if size:
            image.thumbnail((size, size))
        pad = round(100 * image.size[0] / 1024)
        cutout = art_matting.process_image(image, session=session, pad=pad)
        t1 = time.perf_counter()
        webp = finish(cutout)
        t2 = time.perf_counter()
        stats = f"in {image.size[0]}x{image.size[1]}, matte {t1 - t0:.2f}s, export {t2 - t1:.2f}s, out {len(webp) / 1024:.0f} KiB, peak {peak_mb():.0f} MB"
        print(stats, flush=True)
        self.send_response(200)
        self.send_header("content-type", "image/webp")
        self.send_header("x-stats", stats)
        self.end_headers()
        self.wfile.write(webp)


HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
