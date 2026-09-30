import type { AuditRecord } from '@/lib/types';

export type RecordDb = {
  load: () => Promise<AuditRecord[]>;
  insert: (rec: AuditRecord) => Promise<void>;
  update: (rec: AuditRecord) => Promise<void>;
  replaceAll: (recs: AuditRecord[]) => Promise<void>;
};

const KEY = 'narcolens.records';

function read(): AuditRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditRecord[]) : [];
  } catch {
    return [];
  }
}

function write(rows: AuditRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

/** Web demo store. The Android build uses SQLite in db.ts. */
export async function openRecords(): Promise<RecordDb> {
  return {
    load: async () => read(),
    insert: async (rec) => {
      const rows = read().filter((r) => r.id !== rec.id);
      rows.push(rec);
      rows.sort((a, b) => a.seq - b.seq);
      write(rows);
    },
    update: async (rec) => {
      write(read().map((r) => (r.id === rec.id ? rec : r)));
    },
    replaceAll: async (recs) => {
      write(recs);
    },
  };
}
