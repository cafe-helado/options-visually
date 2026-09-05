#!/usr/bin/env python3
"""Generate the PWA icons — the series mark, drawn as PNG without any imaging
library, because the repo has no dependencies and is not about to acquire one.

A PNG is: signature, IHDR, IDAT (zlib of scanlines each prefixed by a filter
byte), IEND. That is the whole format for our purposes.

    python mkicons.py        writes icons/*.png

The mark is the favicon's: a blue ring on the chalk ground. The maskable
variants inset it to 60% so Android's circular crop cannot clip the ring.
"""
import zlib, struct, math, os

CHALK = (0xED, 0xF0, 0xEC)
BLUE = (0x1F, 0x4C, 0xE8)
INK = (0x14, 0x18, 0x1A)


def png(path, w, h, pixels):
    """pixels: a flat list of (r,g,b) tuples, row-major."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)                       # filter type 0, none
        for x in range(w):
            raw += bytes(pixels[y * w + x])
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    out += chunk(b"IEND", b"")
    open(path, "wb").write(out)
    return len(out)


def draw(size, inset, bg=CHALK, ring=BLUE):
    """The mark: a ring of stroke width 3/32 of the art box, centered.
       `inset` is the fraction of the canvas the art occupies — 1.0 for a
       normal icon, 0.6 for a maskable one that must survive a circular crop."""
    px = [bg] * (size * size)
    art = size * inset
    cx = cy = size / 2.0
    r_out = art * (7.0 / 32.0) + art * (1.5 / 32.0)   # radius 7, stroke 3
    r_in = art * (7.0 / 32.0) - art * (1.5 / 32.0)
    ss = 3                                             # supersample for edges
    for y in range(size):
        for x in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    dx = x + (sx + 0.5) / ss - cx
                    dy = y + (sy + 0.5) / ss - cy
                    d = math.hypot(dx, dy)
                    if r_in <= d <= r_out:
                        hits += 1
            if hits:
                a = hits / float(ss * ss)
                px[y * size + x] = tuple(
                    int(round(bg[i] * (1 - a) + ring[i] * a)) for i in range(3))
    return px


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "icons")
    os.makedirs(out, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("maskable-192.png", 192, 0.60),
        ("maskable-512.png", 512, 0.60),
        ("apple-touch-icon.png", 180, 1.0),   # iOS draws its own rounded corners
    ]
    for name, size, inset in jobs:
        n = png(os.path.join(out, name), size, size, draw(size, inset))
        print("  %-24s %4dx%-4d %6d bytes" % (name, size, size, n))
    print("icons/ written")
