"""Resize the supplied full-color raster logo without redrawing or recoloring it.

Usage: python scripts/build-brand-icons.py /path/to/RaceVora_Logo_color.png
Requires Pillow. Generated files are committed; this is not a deploy dependency.
"""

import argparse
import hashlib
from pathlib import Path

from PIL import Image, ImageChops, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    images = root / "assets" / "images"
    icons = root / "assets" / "icons"
    images.mkdir(parents=True, exist_ok=True)
    icons.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.source)
    if source.mode != "RGB":
        raise ValueError("Expected the supplied RGB logo with its original black background")
    red, green, blue = source.split()
    intensity = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    bounds = intensity.point(lambda value: 255 if value > 6 else 0).getbbox()
    if not bounds:
        raise ValueError("Source contains no visible logo")
    # Trim only surplus outer black space; retain the complete mark, glow and clear space.
    left, top, right, bottom = bounds
    mark = source.crop((max(0, left - 24), max(0, top - 24),
                        min(source.width, right + 24), min(source.height, bottom + 24)))
    display = ImageOps.contain(mark, (384, 384), Image.Resampling.LANCZOS)
    display.save(images / "racevora-logo-color.png", optimize=True)

    def square(size, ratio=0.90):
        image = Image.new("RGB", (size, size), "black")
        fitted = ImageOps.contain(mark, (round(size * ratio), round(size * ratio)), Image.Resampling.LANCZOS)
        image.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
        return image

    for size in (16, 32, 48):
        square(size).save(icons / f"favicon-{size}x{size}.png", optimize=True)
    square(180).save(icons / "apple-touch-icon.png", optimize=True)
    for size in (192, 512):
        square(size).save(icons / f"icon-{size}.png", optimize=True)
    # The entire source rectangle fits inside the circular maskable safe zone.
    square(512, 0.64).save(icons / "icon-maskable-512.png", optimize=True)
    square(256).save(root / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"Source SHA-256: {hashlib.sha256(args.source.read_bytes()).hexdigest()}")
    print(f"Logo: {display.width}x{display.height}; RGB colors and proportions preserved")
    print("Created PNG favicons, Apple touch icon, PWA icons, maskable icon and multi-size ICO")


if __name__ == "__main__":
    main()
