# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy", "pillow", "rembg[cpu]==2.0.85"]
# ///
"""Foreground matting for onboarding artwork with soft claymorphic edges.

Uses isnet-general-use neural saliency with corner-sampled padding and
closed-form alpha matting to preserve fine details (peppercorns, seeds,
soft polymer clay contours) without harsh binary thresholding or grey fringing.
"""

import argparse
import io
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageOps
from rembg import new_session, remove
from rembg.bg import alpha_matting_cutout


def process_image(
    image: Image.Image,
    session,
    pad: int = 100,
    fg_threshold: int = 150,
    bg_threshold: int = 10,
    erode_size: int = 0,
) -> Image.Image:
    if pad > 0:
        cell_arr = np.array(image)
        h, w = cell_arr.shape[:2]
        inset_y = max(1, min(5, h // 4))
        inset_x = max(1, min(5, w // 4))
        corners = [
            cell_arr[inset_y, inset_x],
            cell_arr[inset_y, -inset_x],
            cell_arr[-inset_y, inset_x],
            cell_arr[-inset_y, -inset_x],
        ]
        bg_rgb = tuple(int(x) for x in np.median(corners, axis=0)[:3])

        padded = ImageOps.expand(image, border=pad, fill=bg_rgb)
        padded_mask = remove(padded, session=session, only_mask=True)
        pw, ph = padded_mask.size
        mask = padded_mask.crop((pad, pad, pw - pad, ph - pad))
    else:
        mask = remove(image, session=session, only_mask=True)

    return alpha_matting_cutout(
        image,
        mask,
        foreground_threshold=fg_threshold,
        background_threshold=bg_threshold,
        erode_structure_size=erode_size,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", nargs="+", help="Input image path(s)")
    parser.add_argument("--output", nargs="+", help="Output PNG path(s)")
    parser.add_argument("--pad", type=int, default=100, help="Corner-sampled border padding in px (default: 100)")
    parser.add_argument("--fg-threshold", type=int, default=150, help="Foreground threshold (default: 150)")
    parser.add_argument("--bg-threshold", type=int, default=10, help="Background threshold (default: 10)")
    parser.add_argument("--erode-size", type=int, default=0, help="Erode structure size (default: 0)")
    args = parser.parse_args()

    session = new_session("isnet-general-use")

    if args.input and args.output:
        if len(args.input) != len(args.output):
            raise ValueError(f"Number of inputs ({len(args.input)}) must match outputs ({len(args.output)}).")
        for in_path, out_path in zip(args.input, args.output):
            image = Image.open(in_path).convert("RGB")
            cutout = process_image(
                image,
                session=session,
                pad=args.pad,
                fg_threshold=args.fg_threshold,
                bg_threshold=args.bg_threshold,
                erode_size=args.erode_size,
            )
            Path(out_path).parent.mkdir(parents=True, exist_ok=True)
            cutout.save(out_path, format="PNG")
            print(f"Matted {in_path} -> {out_path}")
    else:
        # Fallback to stdin/stdout streaming for single-image use
        image = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")
        cutout = process_image(
            image,
            session=session,
            pad=args.pad,
            fg_threshold=args.fg_threshold,
            bg_threshold=args.bg_threshold,
            erode_size=args.erode_size,
        )
        cutout.save(sys.stdout.buffer, format="PNG")


if __name__ == "__main__":
    main()
