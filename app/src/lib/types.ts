import type { Status, WellResult } from '@/ml/engine';

export type Officer = {
  name: string;
  rank: string;
  short: string;
  badge: string;
  unit: string;
  district: string;
  state: string;
  device: string;
};

export type AuditRecord = {
  seq: number;
  id: string;
  createdAt: string;
  suspect: { name: string; age: string; gender: string };
  fir: string;
  item: string;
  location: { place: string; lat?: number; lng?: number; acc?: number; gps?: boolean };
  witness: string;
  kit: { batch: string; expiry: string };
  officer: { name: string; badge: string; unit: string; device: string };
  wells: WellResult[];
  overall: { status: Status; drug: string | null; conf: number };
  light: string;
  quality: string[];
  photoUri: string | null;
  photoHash: string;
  prevHash: string;
  hash: string;
  confirmed: boolean;
  disputed: string | null;
  synthetic: boolean;
  events: { t: string; e: string }[];
  /** Set only by the verify tamper demo. Not part of the seal. */
  tamperOrig?: { status: Status; drug: string | null; conf: number } | null;
};

export const OFFICERS: Record<string, Officer> = {
  'NCB-DEL-4082': {
    name: 'Rajesh Kumar',
    rank: 'Inspector',
    short: 'Insp.',
    badge: 'NCB-DEL-4082',
    unit: 'NCB · Delhi Zonal Unit',
    district: 'New Delhi',
    state: 'Delhi',
    device: 'FIELD-UNIT-07',
  },
  'NCB-DEL-3127': {
    name: 'Ananya Rao',
    rank: 'Sub-Inspector',
    short: 'SI',
    badge: 'NCB-DEL-3127',
    unit: 'NCB · Delhi Zonal Unit',
    district: 'New Delhi',
    state: 'Delhi',
    device: 'FIELD-UNIT-03',
  },
};

export const GENESIS = '0'.repeat(64);

export function officerLabel(o: Officer): string {
  return `${o.short} ${o.name}`;
}

export function nextId(seq: number): string {
  return `NL-2026-DEL-${String(1040 + seq).padStart(5, '0')}`;
}

export function sealPayload(r: AuditRecord): string {
  return JSON.stringify({
    seq: r.seq,
    id: r.id,
    createdAt: r.createdAt,
    suspect: r.suspect,
    fir: r.fir,
    item: r.item,
    location: r.location,
    witness: r.witness,
    kit: r.kit,
    officer: r.officer,
    wells: r.wells,
    overall: r.overall,
    photoHash: r.photoHash,
    prevHash: r.prevHash,
  });
}

export function drugText(r: AuditRecord, lang: 'en' | 'hi' = 'en'): string {
  const hi = lang === 'hi';
  if (r.overall.status === 'POSITIVE') return r.overall.drug ?? (hi ? 'संकेत मिला' : 'Detected');
  if (r.overall.status === 'NEGATIVE') return hi ? 'कोई ड्रग नहीं मिला' : 'No drug detected';
  return hi ? 'परिणाम अस्पष्ट' : 'Result unclear';
}

export function fmtTime(iso: string, lang: 'en' | 'hi' = 'en'): string {
  return new Date(iso).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function fmtDate(iso: string, lang: 'en' | 'hi' = 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDay(iso: string, lang: 'en' | 'hi' = 'en'): string {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  const hi = lang === 'hi';
  if (d.toDateString() === t.toDateString()) return hi ? 'आज' : 'Today';
  if (d.toDateString() === y.toDateString()) return hi ? 'कल' : 'Yesterday';
  return d.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function shortHash(h: string): string {
  return h.slice(0, 6) + '…' + h.slice(-4);
}
