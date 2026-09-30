/**
 * On-device well reader. Feature order and the v2 head (temperature-scaled
 * softmax + Mahalanobis) match narcolens/ml/train.py and features.py.
 */
import catalog from '../../assets/data/reagents.json';
import model from '../../assets/model/wells-v2.json';

export type Rgb = [number, number, number];
export type Status = 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';

export type Reagent = {
  id: string;
  short: string;
  name: string;
  kit: string;
  target: string;
  baseline: string;
  baselineName: string;
  outcomes: { drug: string; hex: string; colour: string }[];
  steps: string[];
  positive: string;
  timer: number;
};

export type Preset = { id: string; name: string; wells: string[]; desc: string };

export const REAGENTS = catalog.reagents as Record<string, Reagent>;
export const PRESETS = catalog.presets as Preset[];

type Head = {
  classes: string[];
  mean: number[];
  std: number[];
  W: number[][];
  b: number[];
  T: number;
  ood: { thr: number; centres: number[][]; precisions: number[][][] };
};

const HEADS = model.reagents as Record<string, Head>;
const UNCLEAR_BELOW = model.unclear_below as number;
const WHITE_TARGET = model.white_target as number;

export type WellResult = {
  reagentId: string;
  hex: string;
  status: Status;
  drug: string | null;
  colour: string;
  conf: number;
  probs: Record<string, number>;
  model: string;
};

export type Marker = { x: number; y: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function hexToRgb(h: string): Rgb {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function rgbToLab([r, g, b]: Rgb): [number, number, number] {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = f(r);
  const G = f(g);
  const B = f(b);
  const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const X = t((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = t(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = t((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    if (mx === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h * 60, mx > 0 ? d / mx : 0, mx];
}

/** CIEDE2000. Same scalar recipe as the prototype, which matches features.py. */
export function deltaE2000(l1: number[], l2: number[]): number {
  const [L1, a1, b1] = l1;
  const [L2, a2, b2] = l2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (bv: number, av: number) => {
    if (av === 0 && bv === 0) return 0;
    const x = Math.atan2(bv, av) / rad;
    return x < 0 ? x + 360 : x;
  };
  const h1p = h(b1, a1p);
  const h2p = h(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

export type Spread = { spread_L: number; spread_ab: number; glare: number };

export function wellFeatures(reagentId: string, wellRgb: Rgb, whiteRgb: Rgb, stats?: Spread): number[] {
  const R = REAGENTS[reagentId];
  const corr = wellRgb.map((v, k) => clamp(v * (WHITE_TARGET / Math.max(whiteRgb[k], 30)), 0, 255)) as Rgb;
  const lab = rgbToLab(corr);
  const [hd, sat, val] = rgbToHsv(corr);
  const hr = (hd * Math.PI) / 180;
  const wl = rgbToLab(whiteRgb);
  const raw = rgbToLab(wellRgb);
  const drugs = [...new Set(R.outcomes.map((o) => o.drug))];
  const dE = [deltaE2000(lab, rgbToLab(hexToRgb(R.baseline)))];
  for (const d of drugs) {
    dE.push(Math.min(...R.outcomes.filter((o) => o.drug === d).map((o) => deltaE2000(lab, rgbToLab(hexToRgb(o.hex))))));
  }
  while (dE.length < 4) dE.push(100);
  return [
    lab[0], lab[1], lab[2], Math.hypot(lab[1], lab[2]),
    Math.cos(hr) * sat, Math.sin(hr) * sat, sat, val,
    wl[0], wl[1], wl[2], raw[0],
    ...dE.slice(0, 4),
    stats?.spread_L ?? 0,
    stats?.spread_ab ?? 0,
  ];
}

function mahalanobis(z: number[], head: Head): number {
  let best = Infinity;
  const { centres, precisions } = head.ood;
  for (let c = 0; c < centres.length; c++) {
    const mu = centres[c];
    const P = precisions[c];
    const d = z.map((v, i) => v - mu[i]);
    let s = 0;
    for (let i = 0; i < d.length; i++) {
      let row = 0;
      const Pi = P[i];
      for (let j = 0; j < d.length; j++) row += Pi[j] * d[j];
      s += d[i] * row;
    }
    if (s < best) best = s;
  }
  return Math.sqrt(Math.max(best, 0));
}

export function predictWell(reagentId: string, x: number[]): { label: string; p: number; probs: Record<string, number> } {
  const m = HEADS[reagentId];
  const z = x.map((v, i) => (v - m.mean[i]) / (m.std[i] || 1));
  const logits = m.W.map((row, k) => row.reduce((a, w, i) => a + w * z[i], m.b[k]) / (m.T || 1));
  const mx = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const p = ex.map((e) => e / sum);
  let k = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[k]) k = i;
  let label = p[k] < UNCLEAR_BELOW ? 'unclear' : m.classes[k];
  const dist = mahalanobis(z, m);
  if (dist > m.ood.thr && label !== 'unclear') label = 'unclear';
  const probs: Record<string, number> = {};
  m.classes.forEach((c, i) => {
    probs[c] = +p[i].toFixed(3);
  });
  return { label, p: p[k], probs };
}

export function classifyWell(reagentId: string, rgb: Rgb, white: Rgb = [246, 246, 246], stats?: Spread): WellResult {
  const R = REAGENTS[reagentId];
  const x = wellFeatures(reagentId, rgb, white, stats);
  const P = predictWell(reagentId, x);
  const corr = rgb.map((v, k) => clamp(v * (WHITE_TARGET / Math.max(white[k], 30)), 0, 255)) as Rgb;
  const lab = rgbToLab(corr);
  const drugs = [...new Set(R.outcomes.map((o) => o.drug))];
  let status: Status;
  let drug: string | null = null;
  let colour: string;
  if (P.label === 'negative') {
    status = 'NEGATIVE';
    colour = R.baselineName;
  } else if (P.label === 'unclear') {
    status = 'INCONCLUSIVE';
    const dists = drugs.map((d) =>
      Math.min(...R.outcomes.filter((o) => o.drug === d).map((o) => deltaE2000(lab, rgbToLab(hexToRgb(o.hex))))),
    );
    let bi = 0;
    dists.forEach((v, i) => {
      if (v < dists[bi]) bi = i;
    });
    const o = R.outcomes.find((o) => o.drug === drugs[bi]);
    colour = `Between ${R.baselineName.toLowerCase()} and ${(o?.colour ?? 'a known colour').toLowerCase()}`;
  } else {
    status = 'POSITIVE';
    drug = P.label;
    const o = R.outcomes
      .filter((item) => item.drug === drug)
      .sort((a, b) => deltaE2000(lab, rgbToLab(hexToRgb(a.hex))) - deltaE2000(lab, rgbToLab(hexToRgb(b.hex))))[0];
    colour = o?.colour ?? 'Matched colour';
  }
  return {
    reagentId,
    hex: rgbToHex(corr),
    status,
    drug,
    colour,
    conf: Math.min(99, Math.round(P.p * 100)),
    probs: P.probs,
    model: `v${model.version}`,
  };
}

export function combine(wells: WellResult[]): { status: Status; drug: string | null; conf: number } {
  const pos = wells.filter((w) => w.status === 'POSITIVE');
  const status: Status = pos.length ? 'POSITIVE' : wells.every((w) => w.status === 'NEGATIVE') ? 'NEGATIVE' : 'INCONCLUSIVE';
  let drugs = [...new Set(pos.map((w) => w.drug).filter((d): d is string => !!d))];
  if (drugs.includes('Cocaine or Methaqualone') && drugs.some((d) => d === 'Cocaine' || d === 'Methaqualone')) {
    drugs = drugs.filter((d) => d !== 'Cocaine or Methaqualone');
  }
  const pool = status === 'POSITIVE' ? pos : wells;
  const conf =
    status === 'INCONCLUSIVE'
      ? Math.min(...wells.map((w) => w.conf))
      : Math.round(pool.reduce((a, w) => a + w.conf, 0) / Math.max(1, pool.length));
  return { status, drug: drugs.join(' + ') || null, conf };
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}

function labSpread(pixels: Rgb[], white: Rgb): Spread {
  if (pixels.length < 8) return { spread_L: 0, spread_ab: 0, glare: 0 };
  const labs = pixels.map((p) => rgbToLab(p.map((v, k) => clamp(v * (WHITE_TARGET / Math.max(white[k], 30)), 0, 255)) as Rgb));
  const mean = (idx: number) => labs.reduce((a, l) => a + l[idx], 0) / labs.length;
  const sd = (idx: number) => {
    const m = mean(idx);
    return Math.sqrt(labs.reduce((a, l) => a + (l[idx] - m) ** 2, 0) / labs.length);
  };
  return { spread_L: sd(0), spread_ab: Math.hypot(sd(1), sd(2)), glare: 0 };
}

export type PlateRead = {
  wells: WellResult[];
  markers: Marker[];
  rFrac: number;
  light: string;
  quality: string[];
  detected: boolean;
};

function sampleOne(
  data: Uint8Array,
  W: number,
  H: number,
  cx: number,
  cy: number,
  r: number,
): { rgb: Rgb; white: Rgb; stats: Spread } {
  const R: number[] = [];
  const G: number[] = [];
  const B: number[] = [];
  const wr: number[] = [];
  const wg: number[] = [];
  const wb: number[] = [];
  let glareN = 0;
  let innerN = 0;
  const inPix: Rgb[] = [];
  const r2 = r * 1.9;
  const y0 = Math.max(0, (cy - r2) | 0);
  const y1 = Math.min(H, cy + r2);
  const x0 = Math.max(0, (cx - r2) | 0);
  const x1 = Math.min(W, cx + r2);
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const dist = Math.hypot(x - cx, y - cy);
      const i = (y * W + x) * 4;
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      if (dist <= r * 0.65) {
        innerN++;
        if (pr > 245 && pg > 245 && pb > 245) {
          glareN++;
          continue;
        }
        R.push(pr);
        G.push(pg);
        B.push(pb);
        if (inPix.length < 80) inPix.push([pr, pg, pb]);
      } else if (dist >= r * 1.3 && dist <= r * 1.9) {
        wr.push(pr);
        wg.push(pg);
        wb.push(pb);
      }
    }
  }
  const lum = wr.map((v, i) => v + wg[i] + wb[i]);
  const idx = lum
    .map((v, i) => i)
    .sort((a, b) => lum[b] - lum[a])
    .slice(0, Math.max(1, lum.length >> 1));
  const white: Rgb = [median(idx.map((i) => wr[i])), median(idx.map((i) => wg[i])), median(idx.map((i) => wb[i]))];
  const rgb: Rgb = [median(R) || 128, median(G) || 128, median(B) || 128];
  const stats = labSpread(inPix, white);
  stats.glare = innerN ? glareN / innerN : 0;
  return { rgb, white, stats };
}

function gradientEnergy(data: Uint8Array, W: number, H: number, markers: Marker[], rFrac: number): number {
  const r = rFrac * W;
  const xs = markers.map((m) => m.x * W);
  const ys = markers.map((m) => m.y * H);
  const x0 = Math.max(0, Math.min(...xs) - 2 * r) | 0;
  const x1 = Math.min(W - 2, Math.max(...xs) + 2 * r) | 0;
  const y0 = Math.max(0, Math.min(...ys) - 2 * r) | 0;
  const y1 = Math.min(H - 2, Math.max(...ys) + 2 * r) | 0;
  let s = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * W + x) * 4;
      const j = (y * W + x + 1) * 4;
      const g0 = data[i] + data[i + 1] + data[i + 2];
      const g1 = data[j] + data[j + 1] + data[j + 2];
      s += Math.abs(g1 - g0);
      n++;
    }
  }
  return n ? (s / n) * (r / 60) : 0;
}

export function readPlate(
  data: Uint8Array,
  W: number,
  H: number,
  reagentIds: string[],
  markers: Marker[],
  rFrac = 0.085,
): PlateRead {
  const sampled = markers.map((m) => sampleOne(data, W, H, m.x * W, m.y * H, rFrac * W));
  const wells = reagentIds.map((rid, i) => classifyWell(rid, sampled[i].rgb, sampled[i].white, sampled[i].stats));
  const whites = sampled.map((s) => s.white);
  const white = [0, 1, 2].map((k) => median(whites.map((w) => w[k]))) as Rgb;
  const lumW = (white[0] + white[1] + white[2]) / 3;
  const warmth = white[2] / Math.max(1, white[0]);
  let light = 'Balanced light';
  if (lumW < 205) light = 'Low light · corrected';
  else if (warmth < 0.88) light = 'Warm light · corrected';
  else if (warmth > 1.06) light = 'Cool light · corrected';
  const quality: string[] = [];
  const sharp = gradientEnergy(data, W, H, markers, rFrac);
  if (sharp < 6) quality.push('blurry');
  const wLab = whites.map((w) => rgbToLab(w)[0]);
  if (Math.min(...wLab) < 45) quality.push('too_dark');
  if (whites.filter((w) => w[0] >= 252 && w[1] >= 252 && w[2] >= 252).length > whites.length / 2) quality.push('overexposed');
  if (Math.max(...sampled.map((s) => s.stats.glare)) > 0.25) quality.push('glare');
  return { wells, markers, rFrac, light, quality, detected: false };
}

/** Largest bright, low-saturation blob → 3 wells along its long axis. */
export function detectMarkers(data: Uint8Array, W: number, H: number): { markers: Marker[]; rFrac: number } | null {
  const step = 4;
  const mw = Math.ceil(W / step);
  const mh = Math.ceil(H / step);
  const mask = new Uint8Array(mw * mh);
  const hist = new Uint16Array(256);
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : ((mx - mn) / mx) * 255;
      const score = clamp(mx - 0.8 * sat, 0, 255) | 0;
      hist[score]++;
      mask[(y / step) * mw + x / step] = score;
    }
  }
  let total = 0;
  for (let i = 0; i < 256; i++) total += hist[i];
  let sum = 0;
  let otsu = 180;
  let best = -1;
  const sumAll = [...hist].reduce((a, h, i) => a + i * h, 0);
  for (let t = 0; t < 256; t++) {
    sum += hist[t];
    if (!sum || sum === total) continue;
    const w0 = sum / total;
    const w1 = 1 - w0;
    const sumB = [...hist].slice(0, t + 1).reduce((a, h, i) => a + i * h, 0);
    const m0 = sumB / sum;
    const m1 = (sumAll - sumB) / (total - sum);
    const between = w0 * w1 * (m0 - m1) ** 2;
    if (between > best) {
      best = between;
      otsu = t;
    }
  }
  const bin = new Uint8Array(mw * mh);
  for (let i = 0; i < mask.length; i++) bin[i] = mask[i] >= otsu ? 1 : 0;
  const seen = new Uint8Array(mw * mh);
  let bestBlob: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || seen[i]) continue;
    const blob: number[] = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      blob.push(p);
      const x = p % mw;
      const y = (p / mw) | 0;
      const nbrs = [p - 1, p + 1, p - mw, p + mw];
      for (const n of nbrs) {
        if (n < 0 || n >= bin.length || seen[n] || !bin[n]) continue;
        const nx = n % mw;
        const ny = (n / mw) | 0;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (blob.length > bestBlob.length) bestBlob = blob;
  }
  if (bestBlob.length < 40) return null;
  let sx = 0;
  let sy = 0;
  for (const p of bestBlob) {
    sx += p % mw;
    sy += (p / mw) | 0;
  }
  const cx = sx / bestBlob.length;
  const cy = sy / bestBlob.length;
  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;
  for (const p of bestBlob) {
    const dx = (p % mw) - cx;
    const dy = ((p / mw) | 0) - cy;
    mu20 += dx * dx;
    mu02 += dy * dy;
    mu11 += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  let minT = Infinity;
  let maxT = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (const p of bestBlob) {
    const dx = (p % mw) - cx;
    const dy = ((p / mw) | 0) - cy;
    const t = dx * ux + dy * uy;
    const n = -dx * uy + dy * ux;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  }
  const long = (maxT - minT) * step;
  const short = (maxN - minN) * step;
  if (long < W * 0.2 || short < 8) return null;
  const pcx = cx * step;
  const pcy = cy * step;
  const spacing = long * 0.295;
  const r0 = short * 0.29;
  const markers: Marker[] = [-1, 0, 1].map((k) => ({
    x: clamp((pcx + ux * spacing * k) / W, 0.05, 0.95),
    y: clamp((pcy + uy * spacing * k) / H, 0.05, 0.95),
  }));
  return { markers, rFrac: clamp(r0 / W, 0.04, 0.16) };
}

export const DEFAULT_MARKERS: Marker[] = [
  { x: 0.25, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.5 },
];

/** Flat demonstration plate: white ceramic, three coloured wells. */
export function paintSample(colours: string[], w = 480, h = 640): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  const plateL = 0.08 * w;
  const plateT = 0.36 * h;
  const plateW = 0.84 * w;
  const plateH = 0.28 * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inPlate = x >= plateL && x <= plateL + plateW && y >= plateT && y <= plateT + plateH;
      let r = inPlate ? 246 : 110;
      let g = inPlate ? 246 : 98;
      let b = inPlate ? 242 : 90;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const radius = 0.085 * w;
  colours.forEach((hex, k) => {
    const [cr, cg, cb] = hexToRgb(hex);
    const cx = w * (0.25 + 0.25 * k);
    const cy = h * 0.5;
    for (let y = Math.max(0, cy - radius) | 0; y < Math.min(h, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius) | 0; x < Math.min(w, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
        const i = (y * w + x) * 4;
        data[i] = cr;
        data[i + 1] = cg;
        data[i + 2] = cb;
      }
    }
  });
  return data;
}

export const SAMPLES: { id: string; label: string; colours: string[]; wells: string[] }[] = [
  { id: 'cannabis', label: 'Cannabis +', colours: ['#DA521F', '#EFEADF', '#EEE9DE'], wells: ['testB', 'testE1', 'testE2'] },
  { id: 'cocaine', label: 'Cocaine +', colours: ['#ECE6CC', '#2B86CC', '#3AA85C'], wells: ['testB', 'testE1', 'testE2'] },
  { id: 'negative', label: 'All clear', colours: ['#ECE6CA', '#F0EBE1', '#EFEAE0'], wells: ['testB', 'testE1', 'testE2'] },
  { id: 'unclear', label: 'Unclear', colours: ['#A8764A', '#B9B6C9', '#EFEAE0'], wells: ['testB', 'testE1', 'testE2'] },
  { id: 'heroin', label: 'Heroin +', colours: ['#6D307E', '#205C4C', '#E3D64C'], wells: ['marquis', 'mecke', 'mandelin'] },
];

export function readSample(id: string): PlateRead {
  const s = SAMPLES.find((x) => x.id === id) ?? SAMPLES[0];
  const w = 480;
  const h = 640;
  const data = paintSample(s.colours, w, h);
  const read = readPlate(data, w, h, s.wells, DEFAULT_MARKERS, 0.085);
  // Painted discs have no camera noise, so the blur proxy (neighbour gradient) reads as zero.
  return { ...read, quality: read.quality.filter((q) => q !== 'blurry'), detected: true };
}

export function modelNote(lang: 'en' | 'hi' = 'en'): string {
  if (lang === 'hi') {
    return `रंग मॉडल v${model.version} इस फ़ोन पर है और प्लेट की फोटो ऑफ़लाइन पढ़ता है। FIR और किट लेबल के छपे शब्द सर्वर से पढ़े जाते हैं।`;
  }
  return `Colour model v${model.version} is on this phone and reads plate photos offline. Printed FIR and kit labels need the server.`;
}
