// PWA用のシンプルなPNGアイコン(藍色地に白の「E」)を生成する
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

function crc32(buf) {
  let c,
    table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size, file) {
  const bg = [79, 70, 229]; // indigo-600
  const fg = [255, 255, 255];
  // 「E」を矩形で描く
  const u = size / 10;
  const rects = [
    [3 * u, 2.5 * u, 1.2 * u, 5 * u], // 縦棒
    [3 * u, 2.5 * u, 4 * u, 1.1 * u], // 上
    [3 * u, 4.45 * u, 3.2 * u, 1.1 * u], // 中
    [3 * u, 6.4 * u, 4 * u, 1.1 * u], // 下
  ];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inE = rects.some(
        ([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh
      );
      const [r, g, b] = inE ? fg : bg;
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
  console.log(`generated ${file} (${size}x${size})`);
}

makeIcon(192, "public/icon-192.png");
makeIcon(512, "public/icon-512.png");
