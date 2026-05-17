/**
 * Genera los íconos PNG para la PWA sin dependencias externas.
 * Ejecutar desde la raíz del proyecto: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  const out = Buffer.alloc(4);
  out.writeUInt32BE((c ^ 0xFFFFFFFF) >>> 0, 0);
  return out;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, t, data, crc32(Buffer.concat([t, data]))]);
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function makePNG(size, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      row[1 + x * 4]     = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Diseño del ícono ──────────────────────────────────────────────────────────
// Fondo: verde musgo #3D6B4D  (61,107,77)
// Letra U: crema #F6F3EC      (246,243,236)

function drawU(x, y, size) {
  const cx    = size / 2;
  const barW  = size * 0.11;   // ancho de cada barra vertical
  const gap   = size * 0.17;   // distancia del centro al borde interior de las barras
  const top   = size * 0.24;   // borde superior de la U
  const midY  = size * 0.62;   // donde terminan las barras y empieza el arco
  const outerR = gap + barW;   // radio exterior del arco
  const innerR = gap;          // radio interior del arco

  // Barra izquierda
  if (x >= cx - gap - barW && x <= cx - gap && y >= top && y <= midY) return true;
  // Barra derecha
  if (x >= cx + gap && x <= cx + gap + barW && y >= top && y <= midY) return true;
  // Arco inferior (semicírculo hacia abajo)
  const d = Math.sqrt((x - cx) ** 2 + (y - midY) ** 2);
  if (d <= outerR && d >= innerR && y >= midY) return true;

  return false;
}

function iconPixel(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.46;
  const d  = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  if (d > r + 1) return [255, 255, 255, 0]; // transparente fuera del círculo

  const alpha = d > r ? Math.round((r + 1 - d) * 255) : 255; // anti-aliasing suave

  if (drawU(x, y, size)) return [246, 243, 236, alpha]; // crema
  return [61, 107, 77, alpha];                           // verde musgo
}

// ── Generación ────────────────────────────────────────────────────────────────
mkdirSync('public/icons', { recursive: true });

const targets = [
  { size: 192, file: 'public/icons/icon-192.png' },
  { size: 512, file: 'public/icons/icon-512.png' },
  { size: 180, file: 'public/icons/apple-touch-icon.png' },
];

for (const { size, file } of targets) {
  writeFileSync(file, makePNG(size, iconPixel));
  console.log(`✓ ${file}`);
}
