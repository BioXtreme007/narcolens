import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Nav, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { Icon } from '@/components/Icon';
import { KitGuide } from '@/components/KitGuide';
import { C, DRUG_PICKS, R } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { REAGENTS } from '@/ml/engine';
import { drugText, fmtTime, type AuditRecord } from '@/lib/types';

function tone(status: string) {
  if (status === 'POSITIVE') return { bg: C.posSoft, fg: C.pos, icon: 'excl' };
  if (status === 'NEGATIVE') return { bg: C.negSoft, fg: C.neg, icon: 'check' };
  return { bg: C.warnSoft, fg: C.warn, icon: 'q' };
}

function RecRow({ r, onPress, lang }: { r: AuditRecord; onPress: () => void; lang: 'en' | 'hi' }) {
  const t = tone(r.overall.status);
  return (
    <Pressable style={styles.li} onPress={onPress}>
      <View style={[styles.lead, { backgroundColor: t.bg }]}>
        <Icon name={t.icon} size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.liName} numberOfLines={1}>{r.suspect.name}</Text>
        <Text style={styles.liSub} numberOfLines={1}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>{drugText(r, lang)}</Text>
          {' · '}{r.officer.name}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.liTime}>{fmtTime(r.createdAt, lang)}</Text>
        <View style={styles.swatches}>
          {r.wells.map((w, i) => (
            <View key={i} style={[styles.sw, { backgroundColor: w.hex }]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const { officer, records, session } = useApp();
  const c = L(session.lang);
  const router = useRouter();
  const [guide, setGuide] = useState(false);
  const recent = [...records].sort((a, b) => b.seq - a.seq);
  const today = recent.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString());
  const hour = new Date().getHours();
  const greet = hour < 12 ? c.greetMorning : hour < 17 ? c.greetAfternoon : c.greetEvening;
  const initials = officer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const open = (preset?: string) => router.push(preset ? { pathname: '/scan', params: { preset } } : '/scan');

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable style={styles.avatar} onPress={() => router.push('/profile')}>
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet}</Text>
          <Text style={styles.name}>{officer.short} {officer.name}</Text>
        </View>
        <View style={styles.synced}>
          <View style={styles.dot} />
          <Text style={styles.syncedText}>{c.synced}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={styles.wells}>
            {['#DA521F', '#2B86CC', '#EDCB1C'].map((c) => (
              <View key={c} style={[styles.heroWell, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={styles.unit}>{officer.unit}</Text>
          <Text style={styles.heroTitle}>{c.newTest}</Text>
          <Text style={styles.heroSub}>{c.heroSub}</Text>
          <View style={styles.steps}>
            {c.homeSteps.map((s) => (
              <Text key={s} style={styles.step}>{s}</Text>
            ))}
          </View>
          <Pressable style={styles.start} onPress={() => open()}>
            <Icon name="scan" color="#fff" size={18} />
            <Text style={styles.startText}>{c.startTest}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>{c.testingFor}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickScroll} contentContainerStyle={styles.picks}>
          {DRUG_PICKS.map((d) => (
            <Pressable key={d.name} style={styles.pick} onPress={() => open(d.preset)}>
              <View style={styles.pickRing}>
                <View style={[styles.pickDot, { backgroundColor: d.hex }]} />
              </View>
              <Text style={styles.pickName}>{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.audit} onPress={() => router.push('/logs')}>
          <View style={styles.auditTop}>
            <View style={styles.auditIcon}><Icon name="logs" color={C.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{c.audit}</Text>
              <Text style={styles.cardSub}>{c.sealedN(records.length)}</Text>
            </View>
            <Icon name="chev" color={C.ink2} />
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statN}>{today.length}</Text><Text style={styles.statL}>{c.testsToday}</Text></View>
            <View style={styles.stat}><Text style={[styles.statN, { color: C.pos }]}>{today.filter((r) => r.overall.status === 'POSITIVE').length}</Text><Text style={styles.statL}>{c.detected}</Text></View>
            <View style={styles.stat}><Text style={[styles.statN, { color: C.warn }]}>{records.filter((r) => !r.confirmed && !r.disputed).length}</Text><Text style={styles.statL}>{c.toConfirm}</Text></View>
          </View>
        </Pressable>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>{c.recent}</Text>
          <Pressable onPress={() => router.push('/logs')}><Text style={styles.see}>{c.seeAll}</Text></Pressable>
        </View>
        {recent.slice(0, 3).map((r) => (
          <RecRow key={r.id} r={r} lang={session.lang} onPress={() => router.push({ pathname: '/record', params: { id: r.id } })} />
        ))}
        <Pressable style={styles.li} onPress={() => setGuide(true)}>
          <View style={[styles.lead, { backgroundColor: C.surface2 }]}><Icon name="flask" size={18} color={C.ink2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liName}>{c.kitGuide}</Text>
            <Text style={styles.liSub}>{c.kitGuideSub(Object.keys(REAGENTS).length)}</Text>
          </View>
          <Icon name="chev" color={C.ink2} />
        </Pressable>
      </ScrollView>
      <Nav />
      <KitGuide open={guide} lang={session.lang} onClose={() => setGuide(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 72 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.onBrand, fontWeight: '700' },
  greet: { color: C.muted, fontSize: 13 },
  name: { fontSize: 16, fontWeight: '600', color: C.ink },
  synced: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.negSoft, borderRadius: 6, paddingHorizontal: 8, height: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.neg },
  syncedText: { color: C.neg, fontWeight: '700', fontSize: 12 },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  hero: { backgroundColor: C.ink, borderRadius: 24, padding: 20, overflow: 'hidden' },
  wells: { position: 'absolute', right: 18, top: 20, flexDirection: 'row', gap: 6 },
  heroWell: { width: 28, height: 28, borderRadius: 14 },
  unit: { color: '#9A9CA3', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 34 },
  heroSub: { color: '#B7B9BF', marginTop: 2 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  step: { color: '#D7D8DC', fontSize: 12, fontWeight: '600', backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  start: { marginTop: 16, height: 52, borderRadius: 26, backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { fontSize: 16, fontWeight: '600', color: C.ink, marginTop: 22, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  see: { color: C.brand, fontWeight: '600', marginTop: 8 },
  pickScroll: { height: 96 },
  picks: { gap: 2, paddingRight: 8, alignItems: 'flex-start' },
  pick: { width: 86, alignItems: 'center', gap: 8, paddingVertical: 4 },
  pickRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  pickDot: { width: 28, height: 28, borderRadius: 14, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,.2)' },
  pickName: { fontSize: 12, fontWeight: '500', color: C.ink2, textAlign: 'center' },
  audit: { marginTop: 20, backgroundColor: C.surface, borderRadius: R.card, padding: 14 },
  auditTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  auditIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  cardSub: { color: C.muted, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12 },
  statN: { fontSize: 22, fontWeight: '700', color: C.ink },
  statL: { fontSize: 12, color: C.muted, fontWeight: '500' },
  li: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, marginHorizontal: -16, paddingHorizontal: 16 },
  lead: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  liName: { fontSize: 16, fontWeight: '500', color: C.ink },
  liSub: { fontSize: 14, color: C.muted, marginTop: 2 },
  liTime: { fontSize: 12, color: C.muted, marginBottom: 6 },
  swatches: { flexDirection: 'row', gap: 3 },
  sw: { width: 12, height: 12, borderRadius: 6 },
});
