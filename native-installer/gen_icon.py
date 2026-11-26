import struct
import zlib

def make_png(size=64):
    # Render a crisp electric-lime (#c6f527) rounded square with bold black 'C'
    bg_r, bg_g, bg_b = 0xC6, 0xF5, 0x27
    fg_r, fg_g, fg_b = 0x05, 0x07, 0x09
    radius = size * 0.21
    cx = size / 2.0
    cy = size / 2.0
    outer_r = size * 0.30
    inner_r = size * 0.165

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0
        for x in range(size):
            # Rounded-rect alpha check
            dx = max(radius - x, 0.0, x - (size - 1 - radius))
            dy = max(radius - y, 0.0, y - (size - 1 - radius))
            dist_corner = (dx * dx + dy * dy) ** 0.5
            if dist_corner > radius + 0.5:
                raw.extend((0, 0, 0, 0))
                continue

            # Bold geometric 'C' ring with clean right opening
            rx = x - cx
            ry = y - cy
            r = (rx * rx + ry * ry) ** 0.5
            in_ring = inner_r <= r <= outer_r
            in_opening = rx > 0 and abs(ry) < rx * 0.72
            if in_ring and not in_opening:
                raw.extend((fg_r, fg_g, fg_b, 255))
            else:
                raw.extend((bg_r, bg_g, bg_b, 255))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )

def make_ico(path):
    png48 = make_png(48)
    png256 = make_png(256)
    entries = [(48, png48), (0, png256)]  # 0 encodes 256 in ICO format

    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    dir_bytes = bytearray()
    img_bytes = bytearray()

    for dim, data in entries:
        dir_bytes.extend(
            struct.pack(
                "<BBBBHHII",
                dim,
                dim,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        img_bytes.extend(data)
        offset += len(data)

    with open(path, "wb") as f:
        f.write(header + bytes(dir_bytes) + bytes(img_bytes))

if __name__ == "__main__":
    make_ico("native-installer/crackpilot.ico")
    print("Generated native-installer/crackpilot.ico")
