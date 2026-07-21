const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const source = path.join(root, "app", "thryve.png");

/** Near-black / navy background → transparent (corner flood + luminance gate) */
async function toTransparentLogo(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  const isBg = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) return true;
    return r < 45 && g < 55 && b < 80 && r + g + b < 150;
  };

  const visited = new Uint8Array(width * height);
  const stack = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .trim({ threshold: 5 })
    .png();
}

async function fitOnCanvas(logoBuf, size, fillRatio) {
  const meta = await sharp(logoBuf).metadata();
  const maxSide = Math.round(size * fillRatio);
  const scale = Math.min(maxSide / meta.width, maxSide / meta.height);
  const w = Math.max(1, Math.round(meta.width * scale));
  const h = Math.max(1, Math.round(meta.height * scale));

  if (w > size || h > size) {
    return sharp(logoBuf)
      .resize(w, h)
      .extract({
        left: Math.max(0, Math.round((w - size) / 2)),
        top: Math.max(0, Math.round((h - size) / 2)),
        width: size,
        height: size,
      })
      .png()
      .toBuffer();
  }

  const left = Math.round((size - w) / 2);
  const top = Math.round((size - h) / 2);
  const resized = await sharp(logoBuf).resize(w, h).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

/**
 * Build a Vista+ ICO that embeds PNG frames (preserves alpha).
 * Chrome's default ICO uses BMP frames that flatten transparency to black on the desktop.
 */
function encodePngIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  const blobs = [];
  let offset = dataOffset;

  for (const png of pngBuffers) {
    const metaWidth = png.readUInt32BE(16);
    const sizeByte = metaWidth >= 256 ? 0 : metaWidth;

    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(sizeByte, 0); // width
    entry.writeUInt8(sizeByte, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    blobs.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...blobs]);
}

async function main() {
  const logoBuf = await (await toTransparentLogo(source)).png().toBuffer();
  const fill = 1.15;

  const any192 = await fitOnCanvas(logoBuf, 192, fill);
  const any512 = await fitOnCanvas(logoBuf, 512, fill);
  const appIcon = await fitOnCanvas(logoBuf, 512, fill);
  const maskable512 = await fitOnCanvas(logoBuf, 512, fill);

  // Windows desktop uses .ico — every frame must be PNG (alpha), not BMP
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngs = [];
  for (const size of icoSizes) {
    icoPngs.push(await fitOnCanvas(logoBuf, size, fill));
  }
  const icoBuf = encodePngIco(icoPngs);

  fs.writeFileSync(path.join(root, "public", "icon-192.png"), any192);
  fs.writeFileSync(path.join(root, "public", "icon-512.png"), any512);
  fs.writeFileSync(path.join(root, "public", "icon-maskable-512.png"), maskable512);
  fs.writeFileSync(path.join(root, "public", "icon.ico"), icoBuf);
  fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuf);
  fs.writeFileSync(path.join(root, "app", "icon.png"), appIcon);

  console.log("Wrote transparent PNG icons + PNG-in-ICO favicon");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
