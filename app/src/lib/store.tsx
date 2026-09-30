import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { openRecords, type RecordDb } from '@/lib/db';

import { combine, PRESETS, readSample, type WellResult } from '@/ml/engine';
import {
  GENESIS,
  OFFICERS,
  officerLabel,
  nextId,
  sealPayload,
  type AuditRecord,
  type Officer,
} from '@/lib/types';

type Session = {
  onboarded: boolean;
  signedIn: boolean;
  badge: string;
  lang: 'en' | 'hi';
  voice: boolean;
};

const DEFAULT_SESSION: Session = {
  onboarded: false,
  signedIn: false,
  badge: 'NCB-DEL-4082',
  lang: 'en',
  voice: true,
};

type DraftInput = {
  suspect: AuditRecord['suspect'];
  fir: string;
  item: string;
  location: AuditRecord['location'];
  witness: string;
  kit: AuditRecord['kit'];
  wells: WellResult[];
  light: string;
  quality: string[];
  photoUri: string | null;
  photoHash: string;
  synthetic?: boolean;
};

type AppState = {
  ready: boolean;
  session: Session;
  officer: Officer;
  records: AuditRecord[];
  prahariOpen: boolean;
  prahariSeed: string | null;
  prahariFocus: string | null;
  setPrahariOpen: (open: boolean) => void;
  openPrahari: (seed?: string, focusId?: string) => void;
  clearPrahariSeed: () => void;
  completeWelcome: () => Promise<void>;
  signIn: (badge: string, pin: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateSession: (patch: Partial<Session>) => Promise<void>;
  saveRecord: (draft: DraftInput) => Promise<AuditRecord>;
  setVerdict: (id: string, verdict: { confirmed?: boolean; disputed?: string | null; undo?: boolean }) => Promise<void>;
  verifyChain: () => { id: string; ok: boolean }[];
  resetDemo: () => Promise<void>;
  tamperOne: () => Promise<string | null>;
  restoreTamper: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

async function sha256(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

function memoryStore() {
  const hasLocal = typeof localStorage !== 'undefined';
  return {
    getItemAsync: async (k: string) => (hasLocal ? localStorage.getItem(k) : null),
    setItemAsync: async (k: string, v: string) => {
      if (hasLocal) localStorage.setItem(k, v);
    },
    deleteItemAsync: async (k: string) => {
      if (hasLocal) localStorage.removeItem(k);
    },
  };
}

const kv = Platform.OS === 'web' ? memoryStore() : SecureStore;

async function seedRecords(officerOf: (badge: string) => Officer): Promise<AuditRecord[]> {
  const rows: { id: string; badge: string; sus: AuditRecord['suspect']; fir: string; item: string; place: string; lat: number; lng: number; days: number; hour: number; min: number; confirmed: boolean; witness: string; batch: string; expiry: string }[] = [
    { id: 'heroin', badge: 'NCB-DEL-3127', sus: { name: 'Karan Sood', age: '34', gender: 'Male' }, fir: '219/2026', item: 'Powder', place: 'Paharganj, New Delhi', lat: 28.6448, lng: 77.2167, days: 3, hour: 16, min: 20, confirmed: true, witness: 'Ramesh Chand', batch: 'MQ-2026-11A', expiry: '08/2027' },
    { id: 'negative', badge: 'NCB-DEL-3127', sus: { name: 'Rahul Verma', age: '22', gender: 'Male' }, fir: '231/2026', item: 'Leaves / plant', place: 'Chandni Chowk, Delhi', lat: 28.6506, lng: 77.2303, days: 2, hour: 11, min: 5, confirmed: true, witness: '', batch: 'HAL-NDK-2611', expiry: '02/2028' },
    { id: 'cocaine', badge: 'NCB-DEL-4082', sus: { name: 'Suresh Pillai', age: '41', gender: 'Male' }, fir: '238/2026', item: 'Powder', place: 'IGI Airport Cargo, Delhi', lat: 28.5562, lng: 77.1, days: 1, hour: 19, min: 40, confirmed: true, witness: 'Customs Supdt. V. Nair', batch: 'HAL-NDK-2611', expiry: '02/2028' },
    { id: 'unclear', badge: 'NCB-DEL-4082', sus: { name: 'Nikhil Rao', age: '27', gender: 'Male' }, fir: '244/2026', item: 'Resin', place: 'Majnu ka Tilla, Delhi', lat: 28.7006, lng: 77.2273, days: 0, hour: 9, min: 15, confirmed: false, witness: '', batch: 'HAL-NDK-2611', expiry: '02/2028' },
    { id: 'cannabis', badge: 'NCB-DEL-4082', sus: { name: 'Arjun Mehta', age: '25', gender: 'Male' }, fir: '246/2026', item: 'Leaves / plant', place: 'Singhu Border, Delhi', lat: 28.8428, lng: 77.103, days: 0, hour: 12, min: 30, confirmed: true, witness: 'Satyaveer Sharma', batch: 'HAL-NDK-2611', expiry: '02/2028' },
  ];
  const out: AuditRecord[] = [];
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i];
    const read = readSample(x.id);
    const created = new Date();
    created.setDate(created.getDate() - x.days);
    created.setHours(x.hour, x.min, 0, 0);
    const officer = officerOf(x.badge);
    const seq = i + 1;
    const base: AuditRecord = {
      seq,
      id: nextId(seq),
      createdAt: created.toISOString(),
      suspect: x.sus,
      fir: x.fir,
      item: x.item,
      location: { place: x.place, lat: x.lat, lng: x.lng, gps: true },
      witness: x.witness,
      kit: { batch: x.batch, expiry: x.expiry },
      officer: { name: officerLabel(officer), badge: officer.badge, unit: officer.unit, device: officer.device },
      wells: read.wells,
      overall: combine(read.wells),
      light: read.light,
      quality: read.quality,
      photoUri: null,
      photoHash: await sha256('no-photo-' + seq),
      prevHash: prev,
      hash: '',
      confirmed: x.confirmed,
      disputed: null,
      synthetic: true,
      events: [{ t: created.toISOString(), e: 'Test recorded & sealed' }],
    };
    if (x.confirmed) base.events.push({ t: created.toISOString(), e: 'Officer confirmed result' });
    base.hash = await sha256(base.prevHash + '|' + sealPayload(base));
    prev = base.hash;
    out.push(base);
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [prahariOpen, setPrahariOpen] = useState(false);
  const [prahariSeed, setPrahariSeed] = useState<string | null>(null);
  const [prahariFocus, setPrahariFocus] = useState<string | null>(null);
  const [db, setDb] = useState<RecordDb | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const database = await openRecords();
      const saved = await kv.getItemAsync('narcolens.session');
      const sess: Session = saved ? { ...DEFAULT_SESSION, ...JSON.parse(saved) } : DEFAULT_SESSION;
      let recs = await database.load();
      if (!recs.length) {
        recs = await seedRecords((badge) => OFFICERS[badge]);
        for (const r of recs) await database.insert(r);
      }
      if (!live) return;
      sessionRef.current = sess;
      readyRef.current = true;
      setDb(database);
      setSession(sess);
      setRecords(recs);
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  const persistSession = useCallback(async (next: Session) => {
    if (!readyRef.current) return;
    sessionRef.current = next;
    setSession(next);
    await kv.setItemAsync('narcolens.session', JSON.stringify(next));
  }, []);

  const officer = OFFICERS[session.badge] ?? OFFICERS['NCB-DEL-4082'];

  const saveRecord = useCallback(
    async (draft: DraftInput) => {
      const prev = records.reduce<AuditRecord | null>((a, r) => (!a || r.seq > a.seq ? r : a), null);
      const seq = (prev?.seq ?? 0) + 1;
      const createdAt = new Date().toISOString();
      const rec: AuditRecord = {
        seq,
        id: nextId(seq),
        createdAt,
        suspect: draft.suspect,
        fir: draft.fir,
        item: draft.item,
        location: draft.location,
        witness: draft.witness,
        kit: draft.kit,
        officer: { name: officerLabel(officer), badge: officer.badge, unit: officer.unit, device: officer.device },
        wells: draft.wells,
        overall: combine(draft.wells),
        light: draft.light,
        quality: draft.quality,
        photoUri: draft.photoUri,
        photoHash: draft.photoHash,
        prevHash: prev?.hash ?? GENESIS,
        hash: '',
        confirmed: false,
        disputed: null,
        synthetic: !!draft.synthetic,
        events: [{ t: createdAt, e: 'Test recorded & sealed' }],
      };
      rec.hash = await sha256(rec.prevHash + '|' + sealPayload(rec));
      setRecords((list) => [...list, rec]);
      await db?.insert(rec);
      return rec;
    },
    [db, officer, records],
  );

  const setVerdict = useCallback(
    async (id: string, verdict: { confirmed?: boolean; disputed?: string | null; undo?: boolean }) => {
      const current = records.find((r) => r.id === id);
      if (!current) return;
      const events = [...current.events];
      const now = new Date().toISOString();
      let next: AuditRecord;
      if (verdict.undo) {
        events.push({ t: now, e: 'Officer verdict withdrawn' });
        next = { ...current, confirmed: false, disputed: null, events };
      } else if (verdict.confirmed) {
        events.push({ t: now, e: 'Officer confirmed result' });
        next = { ...current, confirmed: true, disputed: null, events };
      } else if (verdict.disputed) {
        events.push({ t: now, e: 'Officer disputed result: ' + verdict.disputed });
        next = { ...current, confirmed: false, disputed: verdict.disputed, events };
      } else {
        return;
      }
      setRecords((list) => list.map((r) => (r.id === id ? next : r)));
      if (db) await db.update(next);
    },
    [db, records],
  );

  const resetDemo = useCallback(async () => {
    if (!db) return;
    const recs = await seedRecords((badge) => OFFICERS[badge]);
    await db.replaceAll(recs);
    setRecords(recs);
  }, [db]);

  const tamperOne = useCallback(async () => {
    const target = [...records].sort((a, b) => a.seq - b.seq).find((r) => r.overall.status === 'POSITIVE' && !r.tamperOrig);
    if (!target || !db) return null;
    const next: AuditRecord = { ...target, tamperOrig: target.overall, overall: { status: 'NEGATIVE', drug: null, conf: 97 } };
    setRecords((list) => list.map((r) => (r.id === target.id ? next : r)));
    await db.update(next);
    return target.suspect.name;
  }, [db, records]);

  const restoreTamper = useCallback(async () => {
    if (!db) return;
    const next = records.map((r) => (r.tamperOrig ? { ...r, overall: r.tamperOrig, tamperOrig: null } : r));
    setRecords(next);
    for (const r of next) {
      if (records.find((o) => o.id === r.id)?.tamperOrig) await db.update(r);
    }
  }, [db, records]);

  const verifyChain = useCallback(() => {
    const sorted = [...records].sort((a, b) => a.seq - b.seq);
    let prev = GENESIS;
    return sorted.map((r) => {
      const ok = r.prevHash === prev;
      prev = r.hash;
      return { id: r.id, ok };
    });
  }, [records]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      session,
      officer,
      records,
      prahariOpen,
      prahariSeed,
      prahariFocus,
      setPrahariOpen,
      openPrahari: (seed?: string, focusId?: string) => {
        setPrahariSeed(seed ?? null);
        setPrahariFocus(focusId ?? null);
        setPrahariOpen(true);
      },
      clearPrahariSeed: () => setPrahariSeed(null),
      completeWelcome: () => persistSession({ ...sessionRef.current, onboarded: true }),
      signIn: async (badge, pin) => {
        const known = OFFICERS[badge.trim().toUpperCase()];
        if (!known || pin !== '1234') return 'Unknown badge or PIN. Demo PIN is 1234.';
        await persistSession({ ...sessionRef.current, signedIn: true, badge: known.badge, onboarded: true });
        return null;
      },
      signOut: () => persistSession({ ...sessionRef.current, signedIn: false }),
      updateSession: (patch) => persistSession({ ...sessionRef.current, ...patch }),
      saveRecord,
      setVerdict,
      verifyChain,
      resetDemo,
      tamperOne,
      restoreTamper,
    }),
    [officer, persistSession, prahariFocus, prahariOpen, prahariSeed, ready, records, resetDemo, restoreTamper, saveRecord, session, setVerdict, tamperOne, verifyChain],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export const DEMO_PIN = '1234';
export const DEFAULT_PLACE = { place: 'Singhu Border, Delhi', lat: 28.8428, lng: 77.103, gps: false as const };
export const DEFAULT_WELLS = PRESETS[0].wells;
