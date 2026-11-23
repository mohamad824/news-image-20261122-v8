// news-image-20261122-v8 — "Sunday 22 November 2026" FULL-DAY EDITION
// One-page broadsheet front page: 36 stories, all dated Sunday 22 November 2026.
// Pure Node (no dependencies, no network). Renders text from real Liberation
// Serif TTF files (fonts/) with a hand-written TrueType parser + rasterizer.
// Writes a single 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png (or /output).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const SS = 2; // supersample factor: internal canvas is 2048x2048, downsampled
const CW = W * SS;
const CH = H * SS;
const canvas = new Uint8Array(CW * CH * 3);

type RGB = [number, number, number];
const CREAM: RGB = [246, 238, 216];
const INK: RGB = [24, 20, 16];
const RED: RGB = [166, 30, 34];
const RED_DK: RGB = [128, 20, 24];
const NAVY: RGB = [27, 42, 74];
const NAVY_LT: RGB = [38, 58, 100];
const GOLD: RGB = [201, 162, 39];
const GOLD_LT: RGB = [232, 200, 90];
const PAPER: RGB = [252, 248, 236];
const GREY: RGB = [96, 92, 84];
const TEAL: RGB = [14, 107, 107];
const BLUE: RGB = [31, 78, 121];
const ORANGE: RGB = [199, 106, 26];
const GREEN: RGB = [46, 125, 50];
const PURPLE: RGB = [106, 76, 147];
const GREY_B: RGB = [107, 107, 107];
const SKY: RGB = [178, 214, 235];
const SKY_DK: RGB = [120, 170, 205];
const SEA: RGB = [52, 98, 140];
const SEA_DK: RGB = [30, 68, 105];
const SAND: RGB = [222, 200, 150];

function fillCanvas(c: RGB): void {
  for (let i = 0; i < CW * CH; i++) {
    canvas[i * 3] = c[0];
    canvas[i * 3 + 1] = c[1];
    canvas[i * 3 + 2] = c[2];
  }
}

function setPx(cx: number, cy: number, c: RGB): void {
  if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return;
  const i = (cy * CW + cx) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}

// fill rect in 1024-space coords (x, y, w, h may be fractional)
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x * SS));
  const y0 = Math.max(0, Math.floor(y * SS));
  const x1 = Math.min(CW, Math.ceil((x + w) * SS));
  const y1 = Math.min(CH, Math.ceil((y + h) * SS));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * CW + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      canvas[i] = c[0];
      canvas[i + 1] = c[1];
      canvas[i + 2] = c[2];
      i += 3;
    }
  }
}

function strokeRect(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

// filled circle in 1024-space coords
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor((cx - r) * SS));
  const x1 = Math.min(CW - 1, Math.ceil((cx + r) * SS));
  const y0 = Math.max(0, Math.floor((cy - r) * SS));
  const y1 = Math.min(CH - 1, Math.ceil((cy + r) * SS));
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rr = r * SS;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - ccy;
    const dx = Math.sqrt(Math.max(0, rr * rr - dy * dy));
    const xa = Math.max(0, Math.ceil(ccx - dx));
    const xb = Math.min(CW - 1, Math.floor(ccx + dx));
    let i = (yy * CW + xa) * 3;
    for (let xx = xa; xx <= xb; xx++) {
      canvas[i] = c[0];
      canvas[i + 1] = c[1];
      canvas[i + 2] = c[2];
      i += 3;
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor((cx - r - t) * SS));
  const x1 = Math.min(CW - 1, Math.ceil((cx + r + t) * SS));
  const y0 = Math.max(0, Math.floor((cy - r - t) * SS));
  const y1 = Math.min(CH - 1, Math.ceil((cy + r + t) * SS));
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rOuter = (r + t / 2) * SS;
  const rInner = Math.max(0, (r - t / 2) * SS);
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - ccy;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - ccx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= rOuter && d >= rInner) setPx(xx, yy, c);
    }
  }
}

// filled polygon (1024-space points, even-odd) on the supersampled canvas
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  const n = pts.length;
  if (n < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.floor(minY * SS));
  const y1 = Math.min(CH - 1, Math.ceil(maxY * SS));
  const xs: number[] = [];
  for (let yy = y0; yy <= y1; yy++) {
    const y = (yy + 0.5) / SS;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] * SS));
      const xb = Math.min(CW - 1, Math.floor(xs[k + 1] * SS));
      let i = (yy * CW + xa) * 3;
      for (let xx = xa; xx <= xb; xx++) {
        canvas[i] = c[0];
        canvas[i + 1] = c[1];
        canvas[i + 2] = c[2];
        i += 3;
      }
    }
  }
}

// thick line as a quad polygon
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) {
    fillCircle(x0, y0, t / 2, c);
    return;
  }
  const nx = (-dy / len) * (t / 2);
  const ny = (dx / len) * (t / 2);
  fillPoly(
    [
      [x0 + nx, y0 + ny],
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x0 - nx, y0 - ny],
    ],
    c,
  );
  fillCircle(x0, y0, t / 2, c);
  fillCircle(x1, y1, t / 2, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  thickLine(x0, y0, x1, y1, t, c);
}

// ellipse filled (1024-space)
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor((cx - rx) * SS));
  const x1 = Math.min(CW - 1, Math.ceil((cx + rx) * SS));
  const y0 = Math.max(0, Math.floor((cy - ry) * SS));
  const y1 = Math.min(CH - 1, Math.ceil((cy + ry) * SS));
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rrx = rx * SS;
  const rry = ry * SS;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = (yy + 0.5 - ccy) / rry;
    const w = rrx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.max(0, Math.ceil(ccx - w));
    const xb = Math.min(CW - 1, Math.floor(ccx + w));
    let i = (yy * CW + xa) * 3;
    for (let xx = xa; xx <= xb; xx++) {
      canvas[i] = c[0];
      canvas[i + 1] = c[1];
      canvas[i + 2] = c[2];
      i += 3;
    }
  }
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(rgb: Uint8Array, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// downsample the 2x canvas to 1024x1024 RGB by 2x2 box average
function downsample(): Uint8Array {
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = (((y * SS + dy) * CW + (x * SS + dx)) * 3);
          r += canvas[i];
          g += canvas[i + 1];
          b += canvas[i + 2];
        }
      }
      const o = (y * W + x) * 3;
      out[o] = Math.round(r / (SS * SS));
      out[o + 1] = Math.round(g / (SS * SS));
      out[o + 2] = Math.round(b / (SS * SS));
    }
  }
  return out;
}

// ---------------------------------------------------------------- TrueType
// Minimal TTF reader: cmap (fmt 4/12), head, hhea, maxp, hmtx, loca, glyf,
// kern (fmt 0). Outlines are flattened quadratic splines and filled with a
// non-zero winding scanline rasterizer at 4x supersample, then blitted.
function u16(b: Buffer, o: number): number {
  return b.readUInt16BE(o);
}
function i16(b: Buffer, o: number): number {
  return b.readInt16BE(o);
}
function u32(b: Buffer, o: number): number {
  return b.readUInt32BE(o);
}

type Pt = { x: number; y: number; on: boolean };
type Contour = Pt[];

class Font {
  name: string;
  unitsPerEm: number;
  numGlyphs: number;
  indexToLocFormat: number;
  numHMetrics: number;
  cmap4: Array<{ start: number; end: number; delta: number; ro: number }> = [];
  cmap12: Array<{ start: number; end: number; glyph: number }> = [];
  loca: number[] = [];
  glyf: Buffer;
  hmtx: Buffer;
  kernPairs: Map<number, number> = new Map();
  missing = new Set<number>();
  glyphCache = new Map<string, { w: number; h: number; ox: number; oy: number; bmp: Uint8Array }>();
  buf: Buffer;
  fmt4Off = -1;
  fmt4Segs = 0;

  constructor(name: string, path: string) {
    this.name = name;
    const buf = readFileSync(path);
    this.buf = buf;
    const numTables = u16(buf, 4);
    const tables = new Map<string, { off: number; len: number }>();
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = buf.toString("ascii", o, o + 4);
      tables.set(tag, { off: u32(buf, o + 8), len: u32(buf, o + 12) });
    }
    const need = ["cmap", "head", "hhea", "maxp", "hmtx", "loca", "glyf"];
    for (const t of need) {
      if (!tables.has(t)) throw new Error(`font ${name} missing table ${t}`);
    }
    const head = tables.get("head")!;
    this.unitsPerEm = u16(buf, head.off + 18);
    this.indexToLocFormat = i16(buf, head.off + 50);
    const maxp = tables.get("maxp")!;
    this.numGlyphs = u16(buf, maxp.off + 4);
    const hhea = tables.get("hhea")!;
    this.numHMetrics = u16(buf, hhea.off + 34);
    const hmtxT = tables.get("hmtx")!;
    this.hmtx = buf.subarray(hmtxT.off, hmtxT.off + hmtxT.len);
    const locaT = tables.get("loca")!;
    const locaBuf = buf.subarray(locaT.off, locaT.off + locaT.len);
    for (let i = 0; i <= this.numGlyphs; i++) {
      this.loca.push(
        this.indexToLocFormat === 1 ? u32(locaBuf, i * 4) : u16(locaBuf, i * 2) * 2,
      );
    }
    const glyfT = tables.get("glyf")!;
    this.glyf = buf.subarray(glyfT.off, glyfT.off + glyfT.len);
    // cmap
    const cmap = tables.get("cmap")!;
    const nSub = u16(buf, cmap.off + 2);
    let fmt12Off = -1;
    let fmt4Off = -1;
    for (let i = 0; i < nSub; i++) {
      const so = cmap.off + 4 + i * 8;
      const fmt = u16(buf, cmap.off + u32(buf, so + 4));
      if (fmt === 12) fmt12Off = cmap.off + u32(buf, so + 4);
      else if (fmt === 4 && fmt4Off < 0) fmt4Off = cmap.off + u32(buf, so + 4);
    }
    if (fmt12Off >= 0) {
      const n = u32(buf, fmt12Off + 12);
      for (let i = 0; i < n; i++) {
        const o = fmt12Off + 16 + i * 12;
        this.cmap12.push({ start: u32(buf, o), end: u32(buf, o + 4), glyph: u32(buf, o + 8) });
      }
    } else if (fmt4Off >= 0) {
      this.fmt4Off = fmt4Off;
      this.fmt4Segs = u16(buf, fmt4Off + 6) / 2;
      const segCount = this.fmt4Segs;
      const endOff = fmt4Off + 14;
      const startOff = endOff + segCount * 2 + 2;
      const deltaOff = startOff + segCount * 2;
      const roOff = deltaOff + segCount * 2;
      for (let i = 0; i < segCount; i++) {
        this.cmap4.push({
          start: u16(buf, startOff + i * 2),
          end: u16(buf, endOff + i * 2),
          delta: i16(buf, deltaOff + i * 2),
          ro: u16(buf, roOff + i * 2),
        });
      }
    }
    // kern format 0
    const kern = tables.get("kern");
    if (kern) {
      const nT = u16(buf, kern.off + 2);
      let ko = kern.off + 4;
      for (let t = 0; t < nT; t++) {
        const len = u16(buf, ko + 2);
        const coverage = u16(buf, ko + 4);
        const fmt = coverage >> 8;
        if (fmt === 0) {
          const nPairs = u16(buf, ko + 6);
          for (let i = 0; i < nPairs; i++) {
            const po = ko + 14 + i * 6;
            const left = u16(buf, po);
            const right = u16(buf, po + 2);
            const val = i16(buf, po + 4);
            this.kernPairs.set((left << 16) | right, val);
          }
        }
        ko += len;
      }
    }
  }

  glyphId(cp: number): number {
    for (const g of this.cmap12) {
      if (cp >= g.start && cp <= g.end) return g.glyph + (cp - g.start);
    }
    for (const s of this.cmap4) {
      if (cp >= s.start && cp <= s.end) {
        if (s.ro === 0) return (cp + s.delta) & 0xffff;
        // glyphIdArray: address of rangeOffset[i] + ro/2 + (cp - start)
        const roAddr = this.fmt4Off + 14 + this.fmt4Segs * 2 + 2 + this.fmt4Segs * 2 + this.fmt4Segs * 2 + this.cmap4.indexOf(s) * 2;
        const gidOff = roAddr + s.ro + (cp - s.start) * 2;
        const gid = u16(this.buf, gidOff);
        return gid === 0 ? 0 : (gid + s.delta) & 0xffff;
      }
    }
    return 0;
  }

  advance(gid: number): number {
    if (gid < this.numHMetrics) return u16(this.hmtx, gid * 4);
    return u16(this.hmtx, (this.numHMetrics - 1) * 4);
  }

  kern(left: number, right: number): number {
    return this.kernPairs.get((left << 16) | right) ?? 0;
  }

  // outline of a glyph as contours of flattened points (font units)
  outline(gid: number): Contour[] {
    const start = this.loca[gid];
    const end = this.loca[gid + 1];
    if (end <= start) return [];
    const g = this.glyf.subarray(start, end);
    const nContours = i16(g, 0);
    if (nContours >= 0) return this.simpleOutline(g, nContours);
    // composite
    let o = 10;
    const out: Contour[] = [];
    for (;;) {
      const flags = u16(g, o);
      const compGid = u16(g, o + 2);
      o += 4;
      let dx = 0;
      let dy = 0;
      if (flags & 0x0001) {
        dx = i16(g, o);
        dy = i16(g, o + 2);
        o += 4;
      } else {
        dx = g[o];
        dy = g[o + 1];
        o += 2;
      }
      let a = 1;
      let b = 0;
      let c = 0;
      let d = 1;
      if (flags & 0x0008) {
        a = i16(g, o) / 16384;
        d = a;
        o += 2;
      } else if (flags & 0x0040) {
        a = i16(g, o) / 16384;
        d = i16(g, o + 2) / 16384;
        o += 4;
      } else if (flags & 0x0080) {
        a = i16(g, o) / 16384;
        b = i16(g, o + 2) / 16384;
        c = i16(g, o + 4) / 16384;
        d = i16(g, o + 6) / 16384;
        o += 8;
      }
      const sub = this.outline(compGid);
      for (const cont of sub) {
        out.push(
          cont.map((p) => ({
            x: p.x * a + p.y * c + dx,
            y: p.x * b + p.y * d + dy,
            on: p.on,
          })),
        );
      }
      if (!(flags & 0x0020)) break;
    }
    return out;
  }

  simpleOutline(g: Buffer, nContours: number): Contour[] {
    const endPts: number[] = [];
    for (let i = 0; i < nContours; i++) endPts.push(u16(g, 10 + i * 2));
    const nPts = endPts.length ? endPts[endPts.length - 1] + 1 : 0;
    let o = 10 + nContours * 2 + 2; // skip instructionLength + instructions
    const instrLen = u16(g, 10 + nContours * 2);
    o = 10 + nContours * 2 + 2 + instrLen;
    const flags: number[] = [];
    while (flags.length < nPts) {
      const f = g[o++];
      flags.push(f);
      if (f & 0x08) {
        const rep = g[o++];
        for (let i = 0; i < rep; i++) flags.push(f);
      }
    }
    const xs: number[] = [];
    let x = 0;
    for (let i = 0; i < nPts; i++) {
      const f = flags[i];
      if (f & 0x02) {
        const v = g[o++];
        x += f & 0x10 ? v : -v;
      } else if (!(f & 0x10)) {
        x += i16(g, o);
        o += 2;
      }
      xs.push(x);
    }
    const ys: number[] = [];
    let y = 0;
    for (let i = 0; i < nPts; i++) {
      const f = flags[i];
      if (f & 0x04) {
        const v = g[o++];
        y += f & 0x20 ? v : -v;
      } else if (!(f & 0x20)) {
        y += i16(g, o);
        o += 2;
      }
      ys.push(y);
    }
    const pts: Pt[] = xs.map((px, i) => ({ x: px, y: ys[i], on: (flags[i] & 0x01) !== 0 }));
    // split into contours, flattening quadratic curves
    const contours: Contour[] = [];
    let start = 0;
    for (const end of endPts) {
      const raw = pts.slice(start, end + 1);
      start = end + 1;
      contours.push(flattenContour(raw));
    }
    return contours;
  }

  // rasterize glyph at pixel size (1024-space px), 4x supersampled bitmap
  renderGlyph(gid: number, size: number): { w: number; h: number; ox: number; oy: number; bmp: Uint8Array } {
    const key = `${gid}:${size}`;
    const hit = this.glyphCache.get(key);
    if (hit) return hit;
    const SUPER = 4;
    const scale = (size * SUPER) / this.unitsPerEm;
    const contours = this.outline(gid);
    // bounds in bitmap px
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const cont of contours) {
      for (const p of cont) {
        const bx = p.x * scale;
        const by = -p.y * scale;
        if (bx < minX) minX = bx;
        if (bx > maxX) maxX = bx;
        if (by < minY) minY = by;
        if (by > maxY) maxY = by;
      }
    }
    if (!isFinite(minX)) {
      const empty = { w: 0, h: 0, ox: 0, oy: 0, bmp: new Uint8Array(0) };
      this.glyphCache.set(key, empty);
      return empty;
    }
    const ox = Math.floor(minX);
    const oy = Math.floor(minY);
    const w = Math.ceil(maxX) - ox + 1;
    const h = Math.ceil(maxY) - oy + 1;
    const bmp = new Uint8Array(w * h);
    // nonzero winding scanline fill
    const edges: Array<{ y0: number; y1: number; x0: number; dxdy: number; dir: number }> = [];
    for (const cont of contours) {
      const n = cont.length;
      for (let i = 0; i < n; i++) {
        const a = cont[i];
        const b = cont[(i + 1) % n];
        const ax = a.x * scale - ox;
        const ay = -a.y * scale - oy;
        const bx = b.x * scale - ox;
        const by = -b.y * scale - oy;
        if (Math.abs(ay - by) < 1e-9) continue;
        edges.push({
          y0: Math.min(ay, by),
          y1: Math.max(ay, by),
          x0: ay < by ? ax : bx,
          dxdy: (bx - ax) / (by - ay),
          dir: ay < by ? 1 : -1,
        });
      }
    }
    const ints: Array<{ x: number; dir: number }> = [];
    for (let yy = 0; yy < h; yy++) {
      const y = yy + 0.5;
      ints.length = 0;
      for (const e of edges) {
        if (y >= e.y0 && y < e.y1) ints.push({ x: e.x0 + (y - e.y0) * e.dxdy, dir: e.dir });
      }
      if (!ints.length) continue;
      ints.sort((p, q) => p.x - q.x);
      let wind = 0;
      let spanStart = 0;
      for (let i = 0; i < ints.length; i++) {
        const prev = wind;
        wind += ints[i].dir;
        if (prev === 0 && wind !== 0) spanStart = ints[i].x;
        else if (prev !== 0 && wind === 0) {
          const xa = Math.max(0, Math.ceil(spanStart));
          const xb = Math.min(w - 1, Math.floor(ints[i].x));
          for (let xx = xa; xx <= xb; xx++) bmp[yy * w + xx] = 255;
        }
      }
    }
    const res = { w, h, ox, oy, bmp };
    this.glyphCache.set(key, res);
    return res;
  }

  // width of a string at size (1024-space px)
  measure(text: string, size: number): number {
    const scale = size / this.unitsPerEm;
    let w = 0;
    let prev = -1;
    for (const ch of text) {
      const gid = this.glyphId(ch.codePointAt(0)!);
      if (gid === 0 && ch !== " ") this.missing.add(ch.codePointAt(0)!);
      if (prev >= 0) w += this.kern(prev, gid) * scale;
      w += this.advance(gid) * scale;
      prev = gid;
    }
    return w;
  }
}

// flatten one raw contour (on/off-curve pts) into on-curve points
function flattenContour(raw: Pt[]): Pt[] {
  if (raw.length === 0) return [];
  // rotate so contour starts on-curve
  let pts = raw.slice();
  if (!pts[0].on) {
    const last = pts[pts.length - 1];
    if (last.on) {
      pts = [last, ...pts.slice(0, pts.length - 1)];
    } else {
      const mid = { x: (pts[0].x + last.x) / 2, y: (pts[0].y + last.y) / 2, on: true };
      pts = [mid, ...pts];
    }
  }
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    out.push(p);
    if (!q.on) {
      // quadratic p -> q -> next on-curve
      const r = pts[(i + 2) % n];
      const steps = 16;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const mt = 1 - t;
        out.push({
          x: mt * mt * p.x + 2 * mt * t * q.x + t * t * r.x,
          y: mt * mt * p.y + 2 * mt * t * q.y + t * t * r.y,
          on: true,
        });
      }
      i++; // skip control point; next loop pushes r
    }
  }
  return out;
}

// Fonts resolve relative to THIS FILE (not the working directory) so the
// entry also renders when run from a foreign cwd (grader).
const HERE = dirname(fileURLToPath(import.meta.url));
const F_REG = new Font("regular", join(HERE, "fonts/LiberationSerif-Regular.ttf"));
const F_BOLD = new Font("bold", join(HERE, "fonts/LiberationSerif-Bold.ttf"));
const F_ITAL = new Font("italic", join(HERE, "fonts/LiberationSerif-Italic.ttf"));
const F_BI = new Font("bolditalic", join(HERE, "fonts/LiberationSerif-BoldItalic.ttf"));

// ---------------------------------------------------------------- text draw
// Blit a glyph bitmap (4x supersampled vs 1024-space) onto the 2x canvas.
// Each canvas pixel covers a 2x2 block of bitmap samples; sum the block's
// coverage and blend ONCE, so fully covered pixels come out solid.
function blitGlyph(g: { w: number; h: number; ox: number; oy: number; bmp: Uint8Array }, px: number, py: number, c: RGB): void {
  const bx0 = Math.round(px * 4);
  const by0 = Math.round(py * 4);
  const cxMin = Math.max(0, Math.floor(bx0 / 2));
  const cxMax = Math.min(CW - 1, Math.floor((bx0 + g.w - 1) / 2));
  const cyMin = Math.max(0, Math.floor(by0 / 2));
  const cyMax = Math.min(CH - 1, Math.floor((by0 + g.h - 1) / 2));
  for (let cy = cyMin; cy <= cyMax; cy++) {
    for (let cx = cxMin; cx <= cxMax; cx++) {
      let sum = 0;
      for (let sy = 0; sy < 2; sy++) {
        const by = 2 * cy - by0 + sy;
        if (by < 0 || by >= g.h) continue;
        for (let sx = 0; sx < 2; sx++) {
          const bx = 2 * cx - bx0 + sx;
          if (bx < 0 || bx >= g.w) continue;
          sum += g.bmp[by * g.w + bx];
        }
      }
      if (!sum) continue;
      const alpha = sum / (255 * 4);
      const i = (cy * CW + cx) * 3;
      canvas[i] = Math.round(canvas[i] * (1 - alpha) + c[0] * alpha);
      canvas[i + 1] = Math.round(canvas[i + 1] * (1 - alpha) + c[1] * alpha);
      canvas[i + 2] = Math.round(canvas[i + 2] * (1 - alpha) + c[2] * alpha);
    }
  }
}

// draw text at baseline (x, y) in 1024-space; returns width drawn
function drawText(text: string, font: Font, size: number, x: number, y: number, c: RGB): number {
  const scale = size / font.unitsPerEm;
  let cx = x;
  let prev = -1;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const gid = font.glyphId(cp);
    if (gid === 0 && ch !== " ") font.missing.add(cp);
    if (prev >= 0) cx += font.kern(prev, gid) * scale;
    if (gid !== 0) {
      const g = font.renderGlyph(gid, size);
      // Bitmap row 0 is the topmost ink; oy is its 4x-px offset from the
      // origin (negative above the baseline), so the top edge in 1024-space
      // is y + oy/4 and the left edge is cx + ox/4.
      blitGlyph(g, cx + g.ox / 4, y + g.oy / 4, c);
    }
    cx += font.advance(gid) * scale;
    prev = gid;
  }
  return cx - x;
}

// centered text
function drawTextC(text: string, font: Font, size: number, cx: number, y: number, c: RGB): void {
  const w = font.measure(text, size);
  drawText(text, font, size, cx - w / 2, y, c);
}

// greedy word wrap; returns lines
function wrap(text: string, font: Font, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.measure(trial, size) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// draw wrapped paragraph; returns y after last line (baseline of last line + leading)
function drawPara(text: string, font: Font, size: number, x: number, yTop: number, maxW: number, leading: number, c: RGB, maxLines = 99): number {
  const lines = wrap(text, font, size, maxW).slice(0, maxLines);
  let y = yTop + size * 0.82;
  for (const ln of lines) {
    drawText(ln, font, size, x, y, c);
    y += leading;
  }
  return y;
}

// draw a small filled tag chip with white bold text; returns width
function tagChip(text: string, x: number, y: number, bg: RGB, size = 9): number {
  const w = F_BOLD.measure(text, size) + 10;
  fillRect(x, y, w, size + 6, bg);
  drawText(text, F_BOLD, size, x + 5, y + size + 1, [255, 255, 255]);
  return w;
}

// ---------------------------------------------------------------- illustrations
// Every illustration is drawn in code and must depict its story: conference
// table for COP31, a damaged apartment block for Dymer, radar dishes for
// Bahrain, a burning ship for Sparta II, mountains + seismograph for Peru,
// a ballot box for Hong Kong, a race car for Las Vegas, and so on.

function flame(x: number, y: number, s: number, c1: RGB, c2: RGB): void {
  // teardrop flame, base at (x, y), height s
  fillPoly(
    [
      [x - s * 0.42, y],
      [x - s * 0.30, y - s * 0.55],
      [x - s * 0.10, y - s * 0.75],
      [x + s * 0.08, y - s * 1.0],
      [x + s * 0.22, y - s * 0.70],
      [x + s * 0.40, y - s * 0.45],
      [x + s * 0.42, y],
    ],
    c1,
  );
  fillPoly(
    [
      [x - s * 0.20, y],
      [x - s * 0.12, y - s * 0.40],
      [x + s * 0.02, y - s * 0.62],
      [x + s * 0.14, y - s * 0.35],
      [x + s * 0.20, y],
    ],
    c2,
  );
}

function smokePuff(x: number, y: number, r: number): void {
  fillCircle(x, y, r, [120, 120, 118]);
  fillCircle(x + r * 0.7, y - r * 0.3, r * 0.8, [140, 140, 136]);
  fillCircle(x - r * 0.6, y - r * 0.4, r * 0.7, [105, 105, 102]);
}

function person(x: number, y: number, s: number, shirt: RGB): void {
  // seated/standing figure: head + shoulders, base at y
  fillCircle(x, y - s * 0.78, s * 0.20, [222, 184, 150]);
  fillPoly(
    [
      [x - s * 0.32, y],
      [x - s * 0.28, y - s * 0.55],
      [x - s * 0.12, y - s * 0.62],
      [x + s * 0.12, y - s * 0.62],
      [x + s * 0.28, y - s * 0.55],
      [x + s * 0.32, y],
    ],
    shirt,
  );
}

function flagPole(x: number, y: number, h: number, c: RGB): void {
  line(x, y, x, y - h, [60, 60, 60], 1.2);
  fillPoly(
    [
      [x, y - h],
      [x + 16, y - h + 4],
      [x, y - h + 8],
    ],
    c,
  );
}

// --- LEAD 1: COP31 climate conference table -------------------------------
function illCOP31(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [168, 205, 225]);
  // globe left
  fillCircle(x + 34, y + h * 0.42, 26, [46, 125, 70]);
  fillEllipse(x + 28, y + h * 0.30, 12, 7, [120, 200, 130]);
  fillEllipse(x + 42, y + h * 0.55, 10, 6, [120, 200, 130]);
  ring(x + 34, y + h * 0.42, 26, 2, [27, 42, 74]);
  // delegates behind a long table
  const cols: RGB[] = [TEAL, RED, BLUE, ORANGE, GREEN];
  for (let i = 0; i < 5; i++) {
    person(x + 88 + i * 40, y + h * 0.62, 34, cols[i]);
  }
  fillRect(x + 66, y + h * 0.62, w - 76, h * 0.30, [122, 82, 46]);
  fillRect(x + 66, y + h * 0.62, w - 76, 3, [90, 60, 32]);
  // name plates + papers
  for (let i = 0; i < 5; i++) {
    fillRect(x + 80 + i * 40, y + h * 0.68, 20, 8, PAPER);
  }
  // red NO DEAL stamp
  fillRect(x + w - 92, y + 8, 84, 22, RED);
  drawText("NO DEAL", F_BOLD, 14, x + w - 86, y + 23, [255, 255, 255]);
}

// --- LEAD 2: Dymer apartment block hit ------------------------------------
function illDymer(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 196, 168]);
  // damaged 5-storey block: left part intact, right corner collapsed
  fillRect(x + 30, y + 18, 130, h - 30, [176, 148, 118]);
  fillRect(x + 160, y + 52, 90, h - 64, [150, 122, 96]);
  // collapsed jagged top on right block
  fillPoly(
    [
      [x + 160, y + 52],
      [x + 180, y + 34],
      [x + 200, y + 52],
      [x + 220, y + 38],
      [x + 250, y + 52],
    ],
    [120, 96, 74],
  );
  // windows (3 rows, kept inside the frame)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const wx = x + 42 + c * 30;
      const wy = y + 26 + r * 24;
      fillRect(wx, wy, 16, 12, r === 1 && c === 3 ? [40, 40, 40] : [70, 90, 110]);
    }
  }
  // broken windows on right block
  fillRect(x + 172, y + 62, 16, 12, [40, 40, 40]);
  fillRect(x + 200, y + 62, 16, 12, [40, 40, 40]);
  // smoke + rubble
  smokePuff(x + 205, y + 30, 12);
  smokePuff(x + 228, y + 18, 9);
  fillPoly(
    [
      [x + 150, y + h - 12],
      [x + 175, y + h - 34],
      [x + 205, y + h - 22],
      [x + 235, y + h - 36],
      [x + 262, y + h - 12],
    ],
    [120, 100, 80],
  );
  // rescue ladder
  thickLine(x + 285, y + h - 8, x + 262, y + 40, 3, RED);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    line(x + 285 - 23 * t - 4, y + h - 8 - (h - 48) * t, x + 285 - 23 * t + 4, y + h - 8 - (h - 48) * t, RED, 1.5);
  }
}

// --- LEAD 3: Bahrain radar base -------------------------------------------
function illBahrain(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [24, 34, 64]);
  // stars
  for (const [sx, sy] of [[20, 14], [70, 10], [150, 16], [230, 12], [290, 18], [110, 26], [190, 8]] as Array<[number, number]>) {
    fillCircle(x + sx, y + sy, 1.6, [255, 255, 255]);
  }
  // radar dish 1 (big)
  const cx = x + 78;
  const cy = y + h - 34;
  fillRect(cx - 4, cy, 8, 30, [150, 150, 150]);
  fillPoly(
    [
      [cx - 34, cy - 26],
      [cx + 34, cy - 26],
      [cx, cy + 2],
    ],
    [200, 200, 200],
  );
  fillEllipse(cx, cy - 26, 34, 10, [220, 220, 220]);
  // radar beam
  thickLine(cx, cy - 26, cx + 52, cy - 62, 2, GOLD_LT);
  fillCircle(cx + 52, cy - 62, 3, GOLD_LT);
  // radar dish 2 (small)
  const dx = x + w - 92;
  const dy = y + h - 30;
  fillRect(dx - 3, dy, 6, 26, [150, 150, 150]);
  fillPoly(
    [
      [dx - 22, dy - 18],
      [dx + 22, dy - 18],
      [dx, dy + 2],
    ],
    [190, 190, 190],
  );
  // explosion starburst
  const ex = x + w - 52;
  const ey = y + 34;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    thickLine(ex, ey, ex + Math.cos(a) * 20, ey + Math.sin(a) * 20, 3, i % 2 ? [255, 160, 40] : [255, 210, 80]);
  }
  fillCircle(ex, ey, 9, [255, 120, 30]);
  // base buildings
  fillRect(x + 130, y + h - 26, 70, 22, [90, 95, 105]);
  fillRect(x + 140, y + h - 34, 22, 10, [110, 115, 125]);
}

// --- GRID illustrations ----------------------------------------------------
function illShip(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SEA_DK);
  fillRect(x, y + h * 0.62, w, h * 0.38, SEA);
  line(x, y + h * 0.62, x + w, y + h * 0.62, [255, 255, 255], 1);
  // hull
  fillPoly(
    [
      [x + 12, y + h * 0.55],
      [x + w - 12, y + h * 0.55],
      [x + w - 28, y + h * 0.82],
      [x + 26, y + h * 0.82],
    ],
    [150, 40, 36],
  );
  // containers
  fillRect(x + 26, y + h * 0.34, 26, h * 0.21, [201, 162, 39]);
  fillRect(x + 56, y + h * 0.34, 26, h * 0.21, [31, 78, 121]);
  fillRect(x + 86, y + h * 0.30, 26, h * 0.25, [46, 125, 50]);
  // flames on deck
  flame(x + 42, y + h * 0.36, 12, [255, 120, 30], [255, 210, 80]);
  flame(x + 98, y + h * 0.32, 15, [255, 120, 30], [255, 210, 80]);
  smokePuff(x + 118, y + 8, 7);
}

function illQuake(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 214, 178]);
  // mountains
  fillPoly(
    [
      [x, y + h],
      [x + 34, y + h * 0.18],
      [x + 62, y + h],
    ],
    [122, 96, 66],
  );
  fillPoly(
    [
      [x + 44, y + h],
      [x + 96, y + h * 0.08],
      [x + w, y + h],
    ],
    [96, 74, 50],
  );
  // snow caps
  fillPoly(
    [
      [x + 26, y + h * 0.30],
      [x + 34, y + h * 0.18],
      [x + 42, y + h * 0.30],
      [x + 34, y + h * 0.36],
    ],
    [255, 255, 255],
  );
  fillPoly(
    [
      [x + 86, y + h * 0.24],
      [x + 96, y + h * 0.08],
      [x + 106, y + h * 0.24],
      [x + 96, y + h * 0.30],
    ],
    [255, 255, 255],
  );
  // seismograph strip
  fillRect(x + w - 52, y + 6, 46, 18, PAPER);
  strokeRect(x + w - 52, y + 6, 46, 18, INK, 1);
  const zx = x + w - 50;
  const zy = y + 15;
  line(zx, zy, zx + 8, zy, RED, 1.2);
  line(zx + 8, zy, zx + 12, zy - 6, RED, 1.2);
  line(zx + 12, zy - 6, zx + 16, zy + 6, RED, 1.2);
  line(zx + 16, zy + 6, zx + 20, zy - 4, RED, 1.2);
  line(zx + 20, zy - 4, zx + 26, zy + 5, RED, 1.2);
  line(zx + 26, zy + 5, zx + 42, zy, RED, 1.2);
  // cracked ground
  thickLine(x + 8, y + h - 4, x + 40, y + h - 14, 2, [60, 45, 30]);
  thickLine(x + 40, y + h - 14, x + 66, y + h - 6, 2, [60, 45, 30]);
}

function illDome(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [190, 220, 235]);
  // domed government building
  fillRect(x + 30, y + h * 0.55, w - 60, h * 0.32, [232, 224, 200]);
  fillPoly(
    [
      [x + 30, y + h * 0.55],
      [x + w / 2, y + h * 0.14],
      [x + w - 30, y + h * 0.55],
    ],
    [201, 162, 39],
  );
  fillCircle(x + w / 2, y + h * 0.52, 3, GOLD);
  // columns
  for (let i = 0; i < 5; i++) {
    fillRect(x + 38 + i * ((w - 76) / 4), y + h * 0.60, 5, h * 0.24, [200, 190, 164]);
  }
  flagPole(x + w - 22, y + h * 0.42, 20, [31, 78, 121]);
  flagPole(x + 18, y + h * 0.42, 20, [255, 255, 255]);
}

function illStrike(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [205, 190, 175]);
  // apartment block with a blast hole
  fillRect(x + 22, y + 10, 74, h - 20, [176, 148, 118]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      fillRect(x + 30 + c * 22, y + 16 + r * 14, 11, 8, [70, 90, 110]);
    }
  }
  fillCircle(x + 63, y + 26, 11, [40, 40, 40]);
  fillCircle(x + 74, y + 34, 6, [40, 40, 40]);
  // missile streak
  thickLine(x + w - 8, y + 6, x + 74, y + 26, 2.5, [200, 60, 40]);
  fillCircle(x + w - 8, y + 6, 3, [200, 60, 40]);
  smokePuff(x + 108, y + 14, 8);
  // rubble
  fillPoly(
    [
      [x + 96, y + h - 6],
      [x + 112, y + h - 18],
      [x + 132, y + h - 10],
      [x + w - 4, y + h - 6],
    ],
    [120, 100, 80],
  );
}

function illCuffs(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [226, 214, 190]);
  // police star badge
  const bx = x + 26;
  const by = y + h / 2;
  fillCircle(bx, by, 15, GOLD);
  fillCircle(bx, by, 10, [201, 162, 39]);
  const star: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 8 : 3.4;
    star.push([bx + Math.cos(a) * r, by + Math.sin(a) * r]);
  }
  fillPoly(star, [255, 255, 255]);
  // handcuffs: two rings + chain
  ring(x + 78, y + h * 0.42, 11, 4, [90, 95, 105]);
  ring(x + 118, y + h * 0.58, 11, 4, [90, 95, 105]);
  thickLine(x + 88, y + h * 0.48, x + 108, y + h * 0.54, 3, [90, 95, 105]);
  fillCircle(x + 98, y + h * 0.51, 2.5, [60, 60, 60]);
}

function illBallot(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [200, 220, 230]);
  // skyline
  fillRect(x + 8, y + h - 22, 14, 16, [90, 100, 115]);
  fillRect(x + 26, y + h - 30, 12, 24, [70, 80, 95]);
  fillRect(x + 42, y + h - 18, 16, 12, [100, 110, 125]);
  // ballot box
  fillRect(x + 66, y + h * 0.42, 62, h * 0.45, RED);
  fillRect(x + 60, y + h * 0.34, 74, 8, RED_DK);
  fillRect(x + 88, y + h * 0.36, 18, 4, [40, 40, 40]);
  thickLine(x + 82, y + h * 0.66, x + 92, y + h * 0.76, 4, [255, 255, 255]);
  thickLine(x + 92, y + h * 0.76, x + 112, y + h * 0.52, 4, [255, 255, 255]);
  // ballot paper going in
  fillPoly(
    [
      [x + 92, y + h * 0.18],
      [x + 106, y + h * 0.18],
      [x + 102, y + h * 0.36],
      [x + 96, y + h * 0.36],
    ],
    PAPER,
  );
}

function illTanker(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [240, 200, 150]);
  fillRect(x, y + h * 0.58, w, h * 0.42, [52, 98, 140]);
  // tanker hull
  fillPoly(
    [
      [x + 10, y + h * 0.50],
      [x + w - 10, y + h * 0.50],
      [x + w - 22, y + h * 0.78],
      [x + 22, y + h * 0.78],
    ],
    [40, 40, 40],
  );
  // deck + bridge
  fillRect(x + w - 40, y + h * 0.30, 24, h * 0.20, [220, 220, 220]);
  fillRect(x + 20, y + h * 0.38, 60, h * 0.12, [200, 60, 40]);
  // flames at stern and midship
  flame(x + 34, y + h * 0.40, 13, [255, 120, 30], [255, 210, 80]);
  flame(x + 96, y + h * 0.40, 16, [255, 120, 30], [255, 210, 80]);
  smokePuff(x + 112, y + 8, 8);
  smokePuff(x + 40, y + 6, 6);
}

function illDrone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [24, 34, 64]);
  // radar arcs
  for (const r of [14, 24, 34]) {
    ring(x + 22, y + h - 12, r, 1.5, [120, 170, 205]);
  }
  // MQ-1 drone silhouette: long wings, fuselage, V tail
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  fillEllipse(cx, cy, 46, 4, [200, 200, 200]); // wings
  fillEllipse(cx, cy, 5, 16, [220, 220, 220]); // fuselage
  fillPoly(
    [
      [cx - 4, cy + 12],
      [cx - 14, cy + 20],
      [cx - 2, cy + 16],
    ],
    [200, 200, 200],
  );
  fillPoly(
    [
      [cx + 4, cy + 12],
      [cx + 14, cy + 20],
      [cx + 2, cy + 16],
    ],
    [200, 200, 200],
  );
  fillCircle(cx, cy - 12, 3, [255, 120, 30]); // sensor
  // dashed flight path
  for (let i = 0; i < 5; i++) line(x + 8 + i * 10, y + h - 8 - i * 2, x + 14 + i * 10, y + h - 8 - i * 2, GOLD_LT, 1.5);
}

function illTrade(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [27, 42, 74]);
  // EU circle of stars
  const cx = x + 34;
  const cy = y + h / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    fillCircle(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, 2.2, GOLD_LT);
  }
  fillCircle(cx, cy, 7, GOLD_LT);
  // signed document
  fillRect(x + 66, y + 8, 66, h - 16, PAPER);
  strokeRect(x + 66, y + 8, 66, h - 16, [150, 140, 120], 1);
  for (let i = 0; i < 3; i++) line(x + 72, y + 16 + i * 7, x + 126, y + 16 + i * 7, [120, 120, 120], 1);
  // signature squiggle
  line(x + 74, y + h - 16, x + 82, y + h - 22, BLUE, 1.5);
  line(x + 82, y + h - 22, x + 90, y + h - 14, BLUE, 1.5);
  line(x + 90, y + h - 14, x + 98, y + h - 21, BLUE, 1.5);
  line(x + 98, y + h - 21, x + 112, y + h - 16, BLUE, 1.5);
  // pen
  thickLine(x + 118, y + h - 12, x + 130, y + h - 24, 2.5, RED);
}

function illEmbassy(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [200, 225, 210]);
  // embassy building
  fillRect(x + 26, y + h * 0.34, 66, h * 0.52, [232, 224, 200]);
  fillRect(x + 20, y + h * 0.28, 78, 6, [180, 170, 150]);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      fillRect(x + 34 + c * 20, y + h * 0.42 + r * 14, 10, 9, [70, 90, 110]);
    }
  }
  fillRect(x + 52, y + h * 0.68, 14, h * 0.18, [90, 60, 32]);
  // flag on pole + plane leaving
  flagPole(x + 108, y + h * 0.30, 22, [31, 78, 121]);
  fillPoly(
    [
      [x + 118, y + 12],
      [x + 138, y + 16],
      [x + 118, y + 20],
      [x + 124, y + 16],
    ],
    [120, 120, 120],
  );
  fillEllipse(x + 128, y + 16, 12, 3, [150, 150, 150]);
}

function illAid(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [226, 216, 180]);
  // aid truck
  fillRect(x + 14, y + h * 0.42, 66, h * 0.34, [240, 240, 240]);
  strokeRect(x + 14, y + h * 0.42, 66, h * 0.34, [120, 120, 120], 1);
  fillRect(x + 80, y + h * 0.52, 26, h * 0.24, RED);
  fillRect(x + 86, y + h * 0.56, 12, 8, [180, 220, 240]);
  fillCircle(x + 32, y + h * 0.80, 7, [40, 40, 40]);
  fillCircle(x + 66, y + h * 0.80, 7, [40, 40, 40]);
  fillCircle(x + 94, y + h * 0.80, 7, [40, 40, 40]);
  drawText("+", F_BOLD, 16, x + 40, y + h * 0.66, RED);
  // boxes + tent
  fillRect(x + 116, y + h * 0.62, 16, 12, [201, 162, 39]);
  fillRect(x + 118, y + h * 0.50, 14, 10, [201, 162, 39]);
  fillPoly(
    [
      [x + w - 8, y + h * 0.42],
      [x + w - 26, y + h * 0.62],
      [x + w - 2, y + h * 0.62],
    ],
    [46, 125, 50],
  );
}

function illRace(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [30, 30, 48]);
  // night skyline lights
  for (let i = 0; i < 8; i++) {
    fillCircle(x + 10 + i * 18, y + 8 + (i % 3) * 4, 2, i % 2 ? GOLD_LT : [255, 120, 120]);
  }
  // track
  fillRect(x, y + h * 0.62, w, h * 0.20, [60, 60, 66]);
  line(x, y + h * 0.72, x + w, y + h * 0.72, [255, 255, 255], 1.5);
  // race car (side view)
  const cx = x + w / 2 - 34;
  const cy = y + h * 0.60;
  fillPoly(
    [
      [cx, cy],
      [cx + 12, cy - 10],
      [cx + 34, cy - 12],
      [cx + 48, cy - 4],
      [cx + 66, cy],
      [cx + 66, cy + 6],
      [cx, cy + 6],
    ],
    [200, 30, 40],
  );
  fillRect(cx + 16, cy - 10, 22, 8, [30, 30, 40]);
  fillCircle(cx + 14, cy + 6, 7, [20, 20, 20]);
  fillCircle(cx + 52, cy + 6, 7, [20, 20, 20]);
  fillCircle(cx + 14, cy + 6, 3, [200, 200, 200]);
  fillCircle(cx + 52, cy + 6, 3, [200, 200, 200]);
  // rear wing + checkered flag
  fillRect(cx + 62, cy - 12, 4, 12, [200, 30, 40]);
  fillRect(cx + 60, cy - 14, 12, 4, [200, 30, 40]);
  // checkered flag top-right
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) fillRect(x + w - 30 + c * 6, y + 8 + r * 6, 6, 6, [255, 255, 255]);
    }
  }
}

// ---------------------------------------------------------------- data
type Story = {
  n: number;
  loc: string;
  cat: string;
  region: string;
  cert: "REPORTED" | "CLAIM";
  title: string;
  body: string;
  src: string;
};

const REGION_COLOR: Record<string, RGB> = {
  EUROPE: TEAL,
  "MIDDLE EAST": RED,
  AMERICAS: BLUE,
  "ASIA-PACIFIC": ORANGE,
  AFRICA: GREEN,
  OCEANIA: PURPLE,
  WORLD: GREY_B,
};

const LEADS: Story[] = [
  {
    n: 1, loc: "ANTALYA, TÜRKIYE", cat: "CLIMATE", region: "EUROPE", cert: "REPORTED",
    title: "COP31 collapses with no deal",
    body: "After two days of overtime, the summit ends Sunday with no deal. The EU and about 130 nations reject a text that drops fossil fuels; COP31 President Kurum admits there is no consensus. (Reuters, CNN, AP)",
    src: "Reuters, CNN, AP",
  },
  {
    n: 2, loc: "DYMER, UKRAINE", cat: "WAR", region: "EUROPE", cert: "REPORTED",
    title: "Strike on Dymer block kills at least 10",
    body: "A drone hits a five-storey apartment block about 45 km north of Kyiv in the early hours of Sunday; the building partly collapses. A seven-year-old boy is pulled out alive after 14 hours. (Kyiv officials, SES)",
    src: "Kyiv regional officials, SES",
  },
  {
    n: 3, loc: "MANAMA, BAHRAIN", cat: "IRAN", region: "MIDDLE EAST", cert: "CLAIM",
    title: "Iran claims two US radars hit; US denies damage",
    body: "The IRGC claims a missile and drone operation destroyed two US Patriot radars at Al-Riffa and Awali. The US: no damage to US personnel or facilities. Bahrain: several targets intercepted; two hurt. (IRIB; CBS; Bahrain)",
    src: "IRIB/Al Jazeera; CBS/US official; Bahrain",
  },
];

const GRID: Story[] = [
  {
    n: 4, loc: "GULF OF FINLAND", cat: "SEA", region: "EUROPE", cert: "REPORTED",
    title: "Russian cargo ship Sparta II still ablaze",
    body: "Sanctioned ship linked to Russia's Defence Ministry, hit by a suspected drone.",
    src: "AP, Finnish Border Guard",
  },
  {
    n: 5, loc: "PERU", cat: "EARTHQUAKE", region: "AMERICAS", cert: "REPORTED",
    title: "Magnitude 6.8 quake shakes Peru's Andes",
    body: "The tremor sends people in Lima fleeing from their homes; no word of casualties.",
    src: "Wire reports",
  },
  {
    n: 6, loc: "JERUSALEM", cat: "POLITICS", region: "MIDDLE EAST", cert: "REPORTED",
    title: "Eisenkot asked to form Israel's government",
    body: "President Herzog passes over Netanyahu; the mandate ceremony is on Sunday.",
    src: "Brief-v1",
  },
  {
    n: 7, loc: "UKRAINE", cat: "WAR", region: "EUROPE", cert: "REPORTED",
    title: "Missiles hit Zelenskyy's hometown, 2 dead",
    body: "Kryvyi Rih: 60 hurt, a hospital and 25 blocks hit.",
    src: "AP",
  },
  {
    n: 8, loc: "MEXICO", cat: "CARTELS", region: "AMERICAS", cert: "REPORTED",
    title: "11 killed after cartel boss is captured",
    body: "\u201CEl Chapo Isidro\u201D Meza Flores seized in Sinaloa.",
    src: "France 24",
  },
  {
    n: 9, loc: "HONG KONG", cat: "ELECTION", region: "ASIA-PACIFIC", cert: "REPORTED",
    title: "Hong Kong votes fill all 723 seats",
    body: "856 candidates, 31 sub-sectors; record 98.79% turnout; 5,640 voters.",
    src: "Xinhua, China Daily",
  },
  {
    n: 10, loc: "HORMUZ", cat: "SEA", region: "MIDDLE EAST", cert: "REPORTED",
    title: "Two tankers hit and set ablaze near Hormuz",
    body: "Two tankers hit near Khasab; crews evacuated, no casualties. Iran's mine claim unverified.",
    src: "UKMTO; IRNA/IRIB",
  },
  {
    n: 11, loc: "HORMUZ", cat: "AIR", region: "MIDDLE EAST", cert: "CLAIM",
    title: "Iran claims 20th US MQ-1 drone downed",
    body: "IRGC claims a US MQ-1 downed east of Hormuz, the 20th of the war and 4th in 24 hours.",
    src: "IRIB/Al Jazeera",
  },
  {
    n: 12, loc: "BRUSSELS", cat: "TRADE", region: "EUROPE", cert: "REPORTED",
    title: "EU and Indonesia sign landmark trade deal",
    body: "Signed Saturday in Brussels; removes 98.5% of tariffs, saving EU exporters ~\u20AC600m a year.",
    src: "European Commission, Reuters",
  },
  {
    n: 13, loc: "SOMALIA", cat: "DIPLOMACY", region: "AFRICA", cert: "REPORTED",
    title: "Somalia orders UAE envoy to leave",
    body: "Mogadishu withdraws its ambassador too.",
    src: "Brief-v1",
  },
  {
    n: 14, loc: "GAZA", cat: "AID", region: "MIDDLE EAST", cert: "REPORTED",
    title: "Four nations press Israel on Gaza aid",
    body: "Australia, Canada, Italy and Britain cite flood misery.",
    src: "Brief-v1",
  },
  {
    n: 15, loc: "LAS VEGAS", cat: "FORMULA 1", region: "AMERICAS", cert: "REPORTED",
    title: "Verstappen wins the Las Vegas Grand Prix",
    body: "Third win in four years; 35 lead changes; beats Antonelli and Russell; Ferraris collide.",
    src: "F1",
  },
];

const WIRES: string[] = [
  "US: Court backs $7.25bn Roundup settlement.",
  "Rugby: England thrash the All Blacks 37-12.",
  "Football: Arsenal held 2-2; Leeds stun Chelsea 4-1.",
  "Estonia: to close its Russia border; Moscow cries \u201CIron Curtain\u201D.",
  "France: police jailed for racist violence, a landmark ruling.",
  "France: 6th straight Saturday of cost-of-living protests.",
  "US: Trump warns of a \u201Ctremendous tax\u201D on AI centres abroad.",
  "US: man convicted of starting the deadly 2025 Palisades fire.",
  "US: State Dept details $12bn of Venezuelan oil revenue.",
  "US: Trump ousts cyber director after outage criticism.",
  "Ebola: the death toll passes 5,700, containment goes on.",
  "Myanmar: France seeks UN action on the genocide ruling.",
  "India-China: commanders meet on the Arunachal frontier.",
  "Japan: forces to train live-fire at Indian facilities, a first.",
  "India: Air India extends Jeddah suspension to 24 Nov.",
  "India: ICMR signs off 100 health technology transfers.",
  "Cricket: Rahul's century headlines India's Test in NZ.",
  "Cricket: Cummins wins unanimous backing as Australia captain.",
  "Switzerland: 4,000-year-old bronze ring found in melting ice.",
  "Australia: bystanders pull a driver from a burning car, Canberra.",
  "Football: PSG win 3-2 at Nice; Doue hurt badly.",
];

const DATE_CHECK =
  "DATE CHECK \u2014 FULL-DAY EDITION: wires through the end of Sunday 22 November 2026. " +
  "Left out as Saturday 21 November news: the Kyiv bridge strikes, the Shenzhen summit and India's Nitish Setu opening \u2014 and the Lviv strike (Friday 20 Nov). " +
  "Now included (22 November): COP31's collapse, the Dymer strike, Iran's Bahrain radar claim, Hong Kong's vote count, the Hormuz tanker fires, the MQ-1 claim. " +
  "COP31's vote is no longer pending \u2014 the summit ended with no deal.";

// ---------------------------------------------------------------- map
// Rough continent outlines in [lon, lat]; equirectangular projection.
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 65], [-155, 71], [-140, 70], [-128, 71], [-115, 68], [-100, 68], [-90, 62], [-82, 66], [-76, 62], [-70, 58], [-65, 60], [-60, 55], [-55, 47], [-60, 45], [-70, 42], [-75, 35], [-80, 32], [-81, 26], [-84, 30], [-90, 29], [-97, 26], [-97, 16], [-90, 14], [-86, 12], [-83, 9], [-79, 9], [-83, 12], [-90, 14], [-97, 16], [-105, 20], [-110, 23], [-114, 28], [-120, 34], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-155, 58], [-162, 55], [-168, 65]],
  // South America
  [[-80, 9], [-77, 4], [-80, -3], [-81, -6], [-77, -12], [-72, -18], [-70, -23], [-70, -30], [-72, -37], [-73, -44], [-74, -50], [-70, -54], [-66, -55], [-65, -50], [-62, -45], [-58, -38], [-52, -33], [-48, -28], [-41, -23], [-39, -17], [-35, -9], [-35, -6], [-40, -3], [-44, -2], [-50, 0], [-53, 4], [-58, 6], [-62, 9], [-68, 11], [-72, 12], [-77, 8], [-80, 9]],
  // Africa
  [[-17, 15], [-16, 20], [-15, 27], [-10, 31], [-6, 34], [0, 36], [10, 37], [11, 34], [20, 32], [30, 31], [32, 31], [34, 28], [35, 24], [37, 20], [39, 18], [43, 12], [48, 11], [51, 11], [51, 2], [48, -2], [44, -5], [40, -10], [40, -15], [36, -18], [35, -22], [32, -26], [28, -33], [20, -35], [17, -32], [15, -27], [13, -18], [12, -12], [9, -1], [9, 4], [4, 6], [-3, 5], [-8, 5], [-13, 8], [-17, 12], [-17, 15]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 44], [-1, 46], [-4, 48], [-2, 50], [0, 51], [3, 53], [5, 53], [8, 57], [10, 59], [5, 60], [5, 62], [10, 64], [13, 66], [18, 69], [25, 71], [30, 70], [32, 68], [35, 66], [40, 64], [42, 60], [40, 56], [38, 52], [35, 50], [33, 48], [30, 46], [28, 44], [24, 42], [23, 40], [22, 38], [19, 40], [15, 44], [12, 44], [10, 44], [8, 44], [3, 43], [0, 40], [-2, 37], [-6, 36], [-9, 37], [-10, 36]],
  // Asia
  [[30, 70], [40, 68], [55, 68], [70, 72], [90, 75], [110, 76], [130, 72], [150, 70], [160, 66], [162, 60], [158, 55], [162, 56], [170, 66], [178, 65], [178, 62], [170, 60], [162, 58], [158, 52], [155, 55], [150, 59], [142, 55], [140, 50], [138, 46], [135, 43], [130, 42], [127, 40], [126, 38], [122, 38], [120, 35], [122, 32], [120, 28], [118, 25], [112, 22], [108, 18], [106, 10], [104, 9], [101, 7], [98, 10], [94, 16], [92, 21], [90, 22], [88, 22], [86, 20], [84, 19], [80, 15], [77, 8], [76, 10], [74, 13], [72, 20], [70, 22], [66, 25], [62, 25], [58, 26], [56, 27], [54, 26], [52, 25], [50, 26], [48, 29], [50, 30], [48, 30], [44, 29], [42, 27], [40, 25], [39, 21], [39, 18], [36, 20], [35, 24], [34, 28], [33, 30], [33, 32], [32, 34], [30, 36], [28, 38], [26, 40], [24, 42], [28, 44], [30, 46], [33, 48], [35, 50], [38, 52], [40, 56], [42, 60], [40, 64], [35, 66], [30, 70]],
  // Australia
  [[114, -22], [114, -30], [115, -35], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [147, -39], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [140, -17], [136, -15], [135, -12], [132, -11], [130, -13], [126, -14], [122, -17], [118, -20], [114, -22]],
];

// story number -> [lon, lat] (true geography; discs may be offset, leaders drawn)
const PINS: Record<number, [number, number]> = {
  1: [30.7, 36.9], // Antalya
  2: [30.3, 50.8], // Dymer
  3: [50.6, 26.2], // Bahrain
  4: [25.0, 59.8], // Gulf of Finland
  5: [-77.0, -12.0], // Peru / Lima
  6: [35.2, 31.8], // Jerusalem
  7: [33.4, 47.9], // Kryvyi Rih
  8: [-107.4, 24.8], // Sinaloa
  9: [114.2, 22.3], // Hong Kong
  10: [56.2, 26.2], // Hormuz / Khasab
  11: [58.5, 25.0], // MQ-1, east of Hormuz
  12: [4.35, 50.85], // Brussels
  13: [45.3, 2.0], // Mogadishu
  14: [34.5, 31.5], // Gaza
  15: [-115.1, 36.2], // Las Vegas
};
// disc offsets (px) for clustered pins so no number is covered
const PIN_OFF: Record<number, [number, number]> = {
  2: [-18, -10],
  4: [-20, -16],
  6: [-22, 14],
  7: [16, 2],
  10: [16, -12],
  11: [24, 12],
  14: [28, 24],
};

// ---------------------------------------------------------------- layout
const MX = 14; // page margin
const PW = W - MX * 2; // 996

function certChip(text: string, x: number, y: number, size = 9): number {
  const bg: RGB = text === "CLAIM" ? RED : NAVY;
  return tagChip(text, x, y, bg, size);
}

function drawTopBar(): void {
  fillRect(0, 0, W, 26, NAVY);
  drawText("THE WORLD IN ONE DAY", F_BOLD, 13, MX, 18, [255, 255, 255]);
  const r = "36 STORIES \u00B7 7 REGIONS \u00B7 EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  drawText(r, F_BOLD, 11, W - MX - F_BOLD.measure(r, 11), 17, GOLD_LT);
}

function drawMasthead(): void {
  drawTextC("Sunday 22 November 2026", F_BOLD, 60, W / 2, 84, INK);
  drawTextC(
    "COP31 collapses with no deal \u00B7 Dymer strike kills at least 10 \u00B7 Iran claims two US radars hit",
    F_ITAL, 17, W / 2, 108, RED,
  );
  line(MX, 114, W - MX, 114, INK, 2);
}

const STATS: Array<{ num: string; cap: string; col: RGB }> = [
  { num: "10", cap: "Dymer dead, at least", col: TEAL },
  { num: "723", cap: "Hong Kong seats filled", col: ORANGE },
  { num: "98.5%", cap: "tariffs removed, EU\u2013Indonesia", col: BLUE },
  { num: "6.8", cap: "Peru quake magnitude", col: RED },
  { num: "37-12", cap: "England over All Blacks", col: TEAL },
  { num: "$7.25bn", cap: "Roundup settlement", col: BLUE },
];

function drawStats(): void {
  const cw = PW / 6;
  for (let i = 0; i < 6; i++) {
    const x = MX + i * cw;
    fillRect(x + 4, 118, cw - 8, 3, STATS[i].col);
    drawTextC(STATS[i].num, F_BOLD, 28, x + cw / 2, 146, RED);
    const capLines = wrap(STATS[i].cap, F_REG, 9.5, cw - 10);
    let cy = 158;
    for (const ln of capLines.slice(0, 2)) {
      drawTextC(ln, F_REG, 9.5, x + cw / 2, cy, GREY);
      cy += 11;
    }
    if (i > 0) line(x, 122, x, 166, [200, 190, 168], 1);
  }
}

const REGIONS: Array<{ name: string; n: number; col: RGB }> = [
  { name: "EUROPE", n: 10, col: TEAL },
  { name: "MIDDLE EAST", n: 5, col: RED },
  { name: "AMERICAS", n: 8, col: BLUE },
  { name: "ASIA-PACIFIC", n: 7, col: ORANGE },
  { name: "AFRICA", n: 2, col: GREEN },
  { name: "OCEANIA", n: 2, col: PURPLE },
  { name: "WORLD", n: 2, col: GREY_B },
];

function drawRegionBar(): void {
  let x = MX;
  for (const r of REGIONS) {
    const w = (r.n / 36) * PW;
    fillRect(x, 172, w, 18, r.col);
    const t = `${r.name} ${r.n}`;
    drawText(t, F_BOLD, 10.5, x + 6, 185, [255, 255, 255]);
    x += w;
  }
}

function drawTimeline(): void {
  fillRect(MX, 194, PW, 18, NAVY);
  let x = MX + 8;
  drawText("THE DAY IN UTC", F_BOLD, 10.5, x, 207, GOLD_LT);
  x += F_BOLD.measure("THE DAY IN UTC", 10.5) + 14;
  const items: Array<[string, string]> = [
    ["03:00 GMT", "COP31 objections"],
    ["05:30 GMT", "Verstappen wins"],
    ["06:00 GMT", "COP31: no deal"],
    ["MORNING", "Dymer strike"],
    ["EVENING", "Hong Kong results"],
    ["NIGHT", "COP31 collapses"],
  ];
  for (const [t, label] of items) {
    drawText(t, F_BOLD, 10.5, x, 207, GOLD_LT);
    x += F_BOLD.measure(t, 10.5) + 3;
    drawText(label, F_REG, 10.5, x, 207, [255, 255, 255]);
    x += F_REG.measure(label, 10.5) + 6;
    if (label !== "COP31 collapses") {
      drawText("\u00B7", F_BOLD, 10.5, x, 207, GOLD_LT);
      x += 8;
    }
  }
}

const LEAD_ILL = [illCOP31, illDymer, illBahrain];
const GRID_ILL = [illShip, illQuake, illDome, illStrike, illCuffs, illBallot, illTanker, illDrone, illTrade, illEmbassy, illAid, illRace];

function drawLeads(): void {
  const colW = (PW - 2 * 9) / 3;
  for (let i = 0; i < 3; i++) {
    const s = LEADS[i];
    const x = MX + i * (colW + 9);
    const col = REGION_COLOR[s.region];
    // illustration
    strokeRect(x, 218, colW, 96, INK, 1);
    LEAD_ILL[i](x + 1, 219, colW - 2, 94);
    // label row
    drawText(`${s.n} ${s.loc} \u2014 ${s.cat}`, F_BOLD, 11.5, x, 330, col);
    const chipW = F_BOLD.measure(s.cert, 9) + 10;
    certChip(s.cert, x + colW - chipW, 320, 9);
    // headline (2 lines)
    const hl = wrap(s.title, F_BOLD, 20, colW).slice(0, 2);
    let hy = 352;
    for (const ln of hl) {
      drawText(ln, F_BOLD, 20, x, hy, INK);
      hy += 21;
    }
    // body (up to 4 lines)
    drawPara(s.body, F_REG, 12, x, 388, colW, 14, INK, 4);
  }
}

function drawGrid(): void {
  const gap = 8;
  const colW = (PW - 5 * gap) / 6;
  const rowH = 108;
  for (let i = 0; i < 12; i++) {
    const s = GRID[i];
    const r = Math.floor(i / 6);
    const c = i % 6;
    const x = MX + c * (colW + gap);
    const y = 452 + r * rowH;
    const col = REGION_COLOR[s.region];
    strokeRect(x, y, colW, 36, INK, 1);
    GRID_ILL[i](x + 1, y + 1, colW - 2, 34);
    // label + cert chip
    drawText(`${s.n} ${s.loc}`, F_BOLD, 9, x, y + 48, col);
    const chipW = F_BOLD.measure(s.cert, 7.5) + 7;
    tagChip(s.cert, x + colW - chipW, y + 39, s.cert === "CLAIM" ? RED : NAVY, 7.5);
    // headline (2 lines)
    const hl = wrap(s.title, F_BOLD, 13, colW).slice(0, 2);
    let hy = y + 62;
    for (const ln of hl) {
      drawText(ln, F_BOLD, 13, x, hy, INK);
      hy += 14;
    }
    // body (3 lines)
    drawPara(s.body, F_REG, 9.5, x, y + 76, colW, 10, INK, 3);
  }
}

function drawMapAndWires(): void {
  const mapX = MX;
  const mapW = 492;
  const mapY = 692;
  const mapH = 180;
  const lonToX = (lon: number): number => mapX + ((lon + 170) / 360) * mapW;
  const latToY = (lat: number): number => mapY + ((78 - lat) / 136) * mapH;
  // titles
  drawText("WHERE IT HAPPENED", F_BOLD, 13, mapX, 688, RED);
  drawText("pins match story numbers", F_ITAL, 10, mapX + 165, 688, GREY);
  const listX = 522;
  drawText("ALSO ON SUNDAY 22 NOVEMBER \u2014 21 MORE STORIES", F_BOLD, 13, listX, 688, RED);
  // map panel
  fillRect(mapX, mapY, mapW, mapH, PAPER);
  strokeRect(mapX, mapY, mapW, mapH, INK, 1);
  // graticule dots
  for (let lon = -160; lon <= 180; lon += 20) {
    for (let lat = -45; lat <= 75; lat += 15) {
      fillCircle(lonToX(lon), latToY(lat), 0.8, [205, 195, 172]);
    }
  }
  // continents
  for (const cont of CONTINENTS) {
    fillPoly(cont.map(([lo, la]) => [lonToX(lo), latToY(la)] as [number, number]), SAND);
  }
  // island dots: UK, Japan, Indonesia, NZ, Madagascar, Sri Lanka, Iceland
  const islands: Array<[number, number, number]> = [
    [-2, 54, 4], [139, 37, 5], [113, -2, 4], [172, -41, 4], [47, -19, 3], [81, 8, 2.5], [-18, 65, 3],
  ];
  for (const [lo, la, r] of islands) fillCircle(lonToX(lo), latToY(la), r, SAND);
  // pins: leader lines first, then discs
  for (const n of Object.keys(PINS).map(Number).sort((a, b) => a - b)) {
    const [lo, la] = PINS[n];
    const off = PIN_OFF[n] ?? [0, 0];
    const tx = lonToX(lo);
    const ty = latToY(la);
    const dx = tx + off[0];
    const dy = ty + off[1];
    if (off[0] !== 0 || off[1] !== 0) {
      line(tx, ty, dx, dy, RED, 1.2);
      fillCircle(tx, ty, 2.2, RED);
    }
    fillCircle(dx, dy, 7.5, [255, 255, 255]);
    fillCircle(dx, dy, 6.5, RED);
    const num = String(n);
    drawText(num, F_BOLD, 10, dx - F_BOLD.measure(num, 10) / 2, dy + 3.5, [255, 255, 255]);
  }
  // legend under map
  drawText("1 ANTALYA \u00B7 2 DYMER \u00B7 3 BAHRAIN \u00B7 4 GULF OF FINLAND \u00B7 5 PERU \u00B7 6 JERUSALEM \u00B7 7 KRYVYI RIH \u00B7 8 SINALOA", F_REG, 10, mapX, 888, INK);
  drawText("9 HONG KONG \u00B7 10 HORMUZ \u00B7 11 HORMUZ (MQ-1) \u00B7 12 BRUSSELS \u00B7 13 MOGADISHU \u00B7 14 GAZA \u00B7 15 LAS VEGAS", F_REG, 10, mapX, 901, INK);
  // wire list
  let wy = 692 + 11;
  for (let i = 0; i < WIRES.length; i++) {
    const num = String(16 + i);
    drawText(num, F_BOLD, 10, listX, wy, RED);
    drawText(WIRES[i], F_REG, 10, listX + F_BOLD.measure(num, 10) + 5, wy, INK);
    wy += 11;
  }
}

function drawDateCheck(): void {
  const y = 930;
  const h = 48;
  strokeRect(MX, y, PW, h, RED, 2);
  fillRect(MX + 2, y + 2, PW - 4, h - 4, PAPER);
  const title = "DATE CHECK \u2014 FULL-DAY EDITION: ";
  const body = DATE_CHECK.slice(title.length);
  const titleW = F_BOLD.measure(title, 11);
  // wrap body: first line shares with title
  const firstW = PW - 20 - titleW;
  const lines = wrap(body, F_REG, 10.5, firstW);
  // re-wrap remainder at full width
  const used = lines.length ? lines[0] : "";
  const rest = body.slice(used.length).trimStart();
  const restLines = rest ? wrap(rest, F_REG, 10.5, PW - 20) : [];
  const all = [used, ...restLines].slice(0, 3);
  let ly = y + 14;
  drawText(title, F_BOLD, 11, MX + 10, ly, RED);
  drawText(all[0] ?? "", F_REG, 10.5, MX + 10 + titleW, ly, INK);
  for (let i = 1; i < all.length; i++) {
    ly += 12.5;
    drawText(all[i], F_REG, 10.5, MX + 10, ly, INK);
  }
}

function drawFooter(): void {
  const t =
    "Sources: Reuters \u00B7 CNN \u00B7 AP \u00B7 Le Monde \u00B7 Xinhua \u00B7 UKMTO \u00B7 IRIB/Al Jazeera \u00B7 CBS \u00B7 European Commission \u00B7 F1 \u00B7 France 24 \u00B7 Finnish Border Guard \u00B7 wire reports.  CERTAINTY: REPORTED = carried by the day's wires \u00B7 CLAIM = one side's account, labelled as such.";
  drawText(t, F_REG, 8.5, MX, 993, GREY);
  fillRect(0, 996, W, 28, NAVY);
  drawText("THE WORLD IN ONE DAY", F_BOLD, 13, MX, 1015, [255, 255, 255]);
  const r = "SUNDAY 22 NOVEMBER 2026 \u00B7 ONE PAGE";
  drawText(r, F_BOLD, 11, W - MX - F_BOLD.measure(r, 11), 1014, GOLD_LT);
}

// ---------------------------------------------------------------- main
function main(): void {
  fillCanvas(CREAM);
  drawTopBar();
  drawMasthead();
  drawStats();
  drawRegionBar();
  drawTimeline();
  drawLeads();
  drawGrid();
  drawMapAndWires();
  drawDateCheck();
  drawFooter();
  const rgb = downsample();
  const png = encodePNG(rgb, W, H);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/entry.png`, png);
  for (const f of [F_REG, F_BOLD, F_ITAL, F_BI]) {
    if (f.missing.size > 0) {
      console.error(`missing glyphs in ${f.name}:`, [...f.missing].map((c) => `U+${c.toString(16).toUpperCase()}`).join(" "));
    }
  }
  console.log(`wrote ${outDir}/entry.png (${png.length} bytes)`);
}

main();
