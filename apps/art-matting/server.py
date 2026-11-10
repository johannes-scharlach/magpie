"""Cuts a drawn dish out of its grey background and returns finished art (ADR 38).

POST /matte with a PNG or JPEG body; the answer is a WebP of at most 512px,
cropped to the dish with 16px to spare. Matting is scripts/art-matting.py,
unchanged: the seeded art went through the same code.

One matte at a time on purpose: a matte peaks around 1.1 GB, and the
machine has 2 GB so Fly can suspend it. Other requests get their own
thread, so /health answers during a matte. Once the shared CPU runs out of
burst a matte takes over a minute, and a blocked health check made Fly
turn every request away with a 502.

    uv run --with numpy --with pillow --with "rembg[cpu]==2.0.85" apps/art-matting/server.py
"""

import importlib.util
import io
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import onnxruntime as ort
from PIL import Image
from rembg import new_session

MATTING_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "art-matting.py"
spec = importlib.util.spec_from_file_location("art_matting", MATTING_SCRIPT)
art_matting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art_matting)

MAX_BODY = 10 * 1024 * 1024
# ONNX Runtime's arena keeps each matte's memory for the next one: 1.3 GB
# idle after the first matte, so the second ran out of memory on Fly. Off,
# a matte peaks around 1.1 GB and the server drops back to 0.3 GB.
opts = ort.SessionOptions()
opts.enable_cpu_mem_arena = False
session = new_session("isnet-general-use", sess_opts=opts)
one_matte_at_a_time = threading.Lock()


def finish(cutout: Image.Image) -> bytes:
    """Same crop and export as the bundled art: alpha > 10, 16px, 512px, q82."""
    bbox = cutout.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if bbox is None:
        raise ValueError("Nothing left after matting")
    left, top, right, bottom = bbox
    width, height = cutout.size
    cutout = cutout.crop(
        (max(0, left - 16), max(0, top - 16), min(width, right + 16), min(height, bottom + 16))
    )
    cutout.thumbnail((512, 512))
    out = io.BytesIO()
    cutout.save(out, format="WEBP", quality=82, alpha_quality=100, method=6)
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            return self.send_error(404)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        if self.path != "/matte":
            return self.send_error(404)
        length = int(self.headers.get("content-length") or 0)
        if not 0 < length <= MAX_BODY:
            return self.send_error(413 if length else 400)
        started = time.perf_counter()
        try:
            image = Image.open(io.BytesIO(self.rfile.read(length))).convert("RGB")
            with one_matte_at_a_time:
                webp = finish(art_matting.process_image(image, session=session))
        except Exception as error:  # Bad input or an empty cutout: the caller logs it.
            return self.send_error(422, str(error))
        print(f"matted {image.size[0]}x{image.size[1]} in {time.perf_counter() - started:.1f}s", flush=True)
        self.send_response(200)
        self.send_header("content-type", "image/webp")
        self.send_header("content-length", str(len(webp)))
        self.end_headers()
        self.wfile.write(webp)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"listening on {port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
