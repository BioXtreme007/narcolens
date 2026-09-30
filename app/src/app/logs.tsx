import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Nav, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { Icon } from '@/components/Icon';
import { C } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { drugText, fmtDay, fmtTime, type AuditRecord } from '@/lib/types';

const FILTER_KEYS = ['all', 'pos', 'neg', 'warn', 'todo'] as const;

function tone(status: string) {
  if (status === 'POSITIVE') return { bg: C.posSoft, fg: C.pos, icon: 'excl' };
  if (status === 'NEGATIVE') return { bg: C.negSoft, fg: C.neg, icon: 'check' };
  return { bg: C.warnSoft, fg: C.warn, icon: 'q' };
}

function Row({ r, onPress, lang }: { r: AuditRecord; onPress: () => void; lang: 'en' | 'hi' }) {
  const t = tone(r.overall.status);
  return (
    <Pressable style={styles.li} onPress={onPress}>
      <View style={[styles.lead, { backgroundColor: t.bg }]}>
        <Icon name={t.icon} size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{r.suspect.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>{drugText(r, lang)}</Text>
          {' · '}{r.officer.name}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.time}>{fmtTime(r.createdAt, lang)}</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {r.wells.map((w, i) => <View key={i} style={[styles.sw, { backgroundColor: w.hex }]} />)}
        </View>
      </View>
    </Pressable>
  );
}

export default function Logs() {
  const { records, session } = useApp();
  const c = L(session.lang);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [f, setF] = useState<(typeof FILTER_KEYS)[number]>('all');
  const filters = [
    ['all', c.filterAll],
    ['pos', c.detected],
    ['neg', c.notDetected],
    ['warn', c.unclear],
    ['todo', c.toConfirm],
  ] as const;
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = [...records].sort((a, b) => b.seq - a.seq).filter((r) => {
      if (f === 'pos' && r.overall.status !== 'POSITIVE') return false;
      if (f === 'neg' && r.overall.status !== 'NEGATIVE') return false;
      if (f === 'warn' && r.overall.status !== 'INCONCLUSIVE') return false;
      if (f === 'todo' && (r.confirmed || r.disputed)) return false;
      if (!query) return true;
      return [r.suspect.name, r.id, r.officer.name, r.fir, drugText(r, session.lang), r.location.place].join(' ').toLowerCase().includes(query);
    });
    const out: { day: string; rows: AuditRecord[] }[] = [];
    for (const r of rows) {
      const day = fmtDay(r.createdAt, session.lang);
      const last = out[out.length - 1];
      if (!last || last.day !== day) out.push({ day, rows: [r] });
      else last.rows.push(r);
    }
    return out;
  }, [records, q, f, session.lang]);

  return (
    <Screen>
      <View style={styles.bar}>
        <Text style={styles.h}>{c.audit}</Text>
        <Text style={styles.badge}>{c.recordsN(records.length)}</Text>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.search}>
          <Icon name="search" color={C.ink2} size={20} />
          <TextInput value={q} onChangeText={setQ} placeholder={c.searchPh} placeholderTextColor={C.muted} style={styles.input} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filters.map(([k, label]) => (
            <Pressable key={k} onPress={() => setF(k)} style={[styles.chip, f === k && styles.chipOn]}>
              <Text style={{ color: f === k ? C.onBrand : C.ink2, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        {groups.length ? groups.map((g) => (
          <View key={g.day}>
            <Text style={styles.group}>{g.day}</Text>
            {g.rows.map((r) => (
              <Row key={r.id} r={r} lang={session.lang} onPress={() => router.push({ pathname: '/record', params: { id: r.id } })} />
            ))}
          </View>
        )) : (
          <View style={styles.empty}>
            <Icon name="search" size={36} color={C.muted} />
            <Text style={styles.emptyTitle}>{c.noRecords}</Text>
            <Text style={styles.sub}>{c.noRecordsSub}</Text>
          </View>
        )}
      </ScrollView>
      <Nav />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h: { fontSize: 26, fontWeight: '700', color: C.ink },
  badge: { backgroundColor: C.surface2, color: C.ink2, fontWeight: '700', fontSize: 12, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  search: { height: 56, borderRadius: 28, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 16, color: C.ink },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: C.brandSoft, borderColor: 'transparent' },
  group: { color: C.brand, fontWeight: '700', fontSize: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 16 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 16 },
  lead: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '500', color: C.ink },
  sub: { color: C.muted, fontSize: 14, marginTop: 2 },
  time: { fontSize: 12, color: C.muted, marginBottom: 6 },
  sw: { width: 12, height: 12, borderRadius: 6 },
  empty: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontWeight: '700', color: C.ink, fontSize: 16, marginTop: 12 },
});
