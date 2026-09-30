import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Btn, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { Icon } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { modelNote } from '@/ml/engine';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';

export default function Profile() {
  const { officer, session, updateSession, signOut, resetDemo, setPrahariOpen } = useApp();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    setPrahariOpen(false);
  }, [setPrahariOpen]);
  const initials = officer.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const c = L(session.lang);

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><Icon name="back" color={C.ink2} /></Pressable>
        <Text style={styles.title}>{c.profile}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.who}>
          <View style={styles.avatar}><Text style={styles.avatarT}>{initials}</Text></View>
          <View>
            <Text style={styles.name}>{officer.short} {officer.name}</Text>
            <Text style={styles.sub}>{officer.rank} · {officer.unit}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Kv k={c.badge} v={officer.badge} />
          <Kv k={c.device} v={officer.device} />
          <Kv k={c.district} v={`${officer.district}, ${officer.state}`} />
        </View>
        <Text style={styles.section}>{c.voiceTitle}</Text>
        <View style={styles.cardPad}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowT}>{c.speakAloud}</Text>
              <Text style={styles.sub}>{c.speakSub}</Text>
            </View>
            <Switch value={session.voice} onValueChange={(voice) => updateSession({ voice })} trackColor={{ true: C.brand, false: C.outline }} />
          </View>
          <View style={styles.div} />
          <Text style={styles.fieldLabel}>{c.language}</Text>
          <View style={styles.chips}>
            {([['en', 'English'], ['hi', 'हिंदी']] as const).map(([code, label]) => {
              const on = session.lang === code;
              return (
                <Pressable key={code} onPress={() => updateSession({ lang: code })} style={[styles.chip, on && styles.chipOn]}>
                  {on ? <Icon name="check" size={16} color={C.onBrand} /> : null}
                  <Text style={{ color: on ? C.onBrand : C.ink2, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={styles.section}>{c.data}</Text>
        {confirmReset ? (
          <View style={styles.cardPad}>
            <Text style={styles.rowT}>{c.resetAsk}</Text>
            <Text style={styles.sub}>{c.resetSub}</Text>
            <View style={styles.acts}>
              <Pressable onPress={() => setConfirmReset(false)}><Text style={styles.act}>{c.cancel}</Text></Pressable>
              <Pressable onPress={async () => { await resetDemo(); setConfirmReset(false); router.replace('/home'); }}><Text style={styles.act}>{c.reset}</Text></Pressable>
            </View>
          </View>
        ) : (
          <Btn kind="outline" icon="refresh" label={c.resetDemo} onPress={() => setConfirmReset(true)} />
        )}
        <Pressable style={styles.sign} onPress={async () => { await signOut(); router.replace('/login'); }}>
          <Icon name="logout" color={C.pos} size={18} />
          <Text style={{ color: C.pos, fontWeight: '700' }}>{c.signOut}</Text>
        </Pressable>
        <Text style={styles.note}>{modelNote(session.lang)}</Text>
        <Text style={styles.foot}>{c.foot}</Text>
      </ScrollView>
    </Screen>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: C.onBrand, fontWeight: '700', fontSize: 22 },
  name: { fontSize: 20, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: R.card, paddingHorizontal: 16 },
  cardPad: { borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 16 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  k: { color: C.muted, fontSize: 14 },
  v: { fontWeight: '600', fontSize: 14 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowT: { fontSize: 16, fontWeight: '500' },
  div: { height: 1, backgroundColor: C.line, marginVertical: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: C.ink2, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.outline, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: C.brandSoft, borderColor: 'transparent' },
  acts: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  act: { color: C.brand, fontWeight: '700', padding: 10 },
  sign: { marginTop: 8, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  note: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  foot: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 12 },
});
