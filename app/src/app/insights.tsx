import { StyleSheet, Text, View } from 'react-native';

import { Nav, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { C, R } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';

export default function Insights() {
  const { records, session } = useApp();
  const c = L(session.lang);
  const pos = records.filter((r) => r.overall.status === 'POSITIVE');
  const byDrug: Record<string, number> = {};
  pos.forEach((r) => (r.overall.drug ?? '').split(' + ').filter(Boolean).forEach((d) => { byDrug[d] = (byDrug[d] ?? 0) + 1; }));
  const max = Math.max(1, ...Object.values(byDrug));
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const dayRs = records.filter((r) => new Date(r.createdAt).toDateString() === d.toDateString());
    return { l: d.toLocaleDateString(session.lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' }), n: dayRs.length, p: dayRs.filter((r) => r.overall.status === 'POSITIVE').length };
  });
  const dmax = Math.max(1, ...days.map((d) => d.n));
  const plot = 90;
  const byOff: Record<string, number> = {};
  records.forEach((r) => { byOff[r.officer.name] = (byOff[r.officer.name] ?? 0) + 1; });

  return (
    <Screen>
      <View style={styles.bar}>
        <Text style={styles.h}>{c.insights}</Text>
        <Text style={styles.badge}>{c.last7}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={styles.stats}>
          <Stat n={String(records.length)} l={c.totalTests} />
          <Stat n={`${Math.round((pos.length / Math.max(1, records.length)) * 100)}%`} l={c.detected} color={C.pos} />
          <Stat n={String(records.filter((r) => r.confirmed).length)} l={c.confirmed} />
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{c.testsPerDay}</Text>
          <View style={styles.cols}>
            {days.map((d, i) => {
              const other = d.n - d.p;
              const otherH = other > 0 ? Math.max(3, (other / dmax) * plot) : d.n === 0 ? 3 : 0;
              const posH = d.p > 0 ? Math.max(3, (d.p / dmax) * plot) : 0;
              return (
                <View key={i} style={styles.col}>
                  <View style={styles.stack}>
                    {otherH > 0 ? (
                      <View style={{ height: otherH, backgroundColor: C.ink, width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: posH ? 2 : 3, borderBottomRightRadius: posH ? 2 : 3 }} />
                    ) : null}
                    {posH > 0 ? (
                      <View style={{ height: posH, backgroundColor: C.pos, width: '100%', borderTopLeftRadius: otherH ? 2 : 6, borderTopRightRadius: otherH ? 2 : 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
                    ) : null}
                  </View>
                  <Text style={styles.day}>{d.l}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: C.pos }]} />
              <Text style={styles.legendT}>{c.detected}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: C.ink }]} />
              <Text style={styles.legendT}>{c.other}</Text>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{c.byDrug}</Text>
          {Object.keys(byDrug).length === 0 ? <Text style={styles.empty}>{c.noPositives}</Text> : null}
          {Object.entries(byDrug).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
            <View key={d} style={styles.barRow}>
              <Text style={styles.drug} numberOfLines={1}>{d}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${(n / max) * 100}%` }]} /></View>
              <Text style={styles.n}>{n}</Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          {Object.entries(byOff).map(([o, n]) => (
            <View key={o} style={styles.kv}>
              <Text style={{ color: C.muted }}>{o}</Text>
              <Text style={{ fontWeight: '600', color: C.ink }}>{c.testsN(n)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Nav />
    </Screen>
  );
}

function Stat({ n, l, color }: { n: string; l: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, color ? { color } : null]}>{n}</Text>
      <Text style={styles.statL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h: { fontSize: 26, fontWeight: '700', color: C.ink },
  badge: { backgroundColor: C.surface2, color: C.ink2, fontWeight: '700', fontSize: 12, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  stats: { flexDirection: 'row', gap: 8, backgroundColor: C.surface, borderRadius: R.card, padding: 10 },
  stat: { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12 },
  statN: { fontSize: 22, fontWeight: '700', color: C.ink },
  statL: { fontSize: 12, color: C.muted, fontWeight: '500' },
  card: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 16 },
  title: { fontSize: 16, fontWeight: '600', color: C.ink },
  cols: { flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: 12, gap: 8 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  stack: { width: '100%', height: 90, justifyContent: 'flex-end', gap: 2 },
  day: { fontSize: 11, color: C.muted, fontWeight: '700', marginTop: 6 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendT: { fontSize: 12, color: C.muted, fontWeight: '600' },
  empty: { color: C.muted, fontSize: 14, marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  drug: { width: 110, fontSize: 13, fontWeight: '500', color: C.ink },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.surface2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.brand },
  n: { fontWeight: '700', color: C.ink, width: 16 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
});
