import * as SQLite from 'expo-sqlite';

import type { AuditRecord } from '@/lib/types';

export type RecordDb = {
  load: () => Promise<AuditRecord[]>;
  insert: (rec: AuditRecord) => Promise<void>;
  update: (rec: AuditRecord) => Promise<void>;
  replaceAll: (recs: AuditRecord[]) => Promise<void>;
};

export async function openRecords(): Promise<RecordDb> {
  const database = await SQLite.openDatabaseAsync('narcolens.db');
  await database.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, seq INTEGER, json TEXT);
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);`);
  return {
    load: async () => {
      const rows = await database.getAllAsync<{ json: string }>('SELECT json FROM records ORDER BY seq');
      return rows.map((r) => JSON.parse(r.json) as AuditRecord);
    },
    insert: async (rec) => {
      await database.runAsync('INSERT INTO records (id, seq, json) VALUES (?, ?, ?)', rec.id, rec.seq, JSON.stringify(rec));
    },
    update: async (rec) => {
      await database.runAsync('UPDATE records SET json = ? WHERE id = ?', JSON.stringify(rec), rec.id);
    },
    replaceAll: async (recs) => {
      await database.runAsync('DELETE FROM records');
      for (const rec of recs) {
        await database.runAsync('INSERT INTO records (id, seq, json) VALUES (?, ?, ?)', rec.id, rec.seq, JSON.stringify(rec));
      }
    },
  };
}
