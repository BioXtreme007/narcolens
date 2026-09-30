import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Btn, Field, Nav, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { Icon } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { sealPayload, shortHash } from '@/lib/types';

type Why = 'intact' | 'content' | 'chain';
type Row = { id: string; seq: number; name: string; hash: string; ok: boolean; why: Why };

export default function Verify() {
  const { records, tamperOne, restoreTamper, session } = useApp();
  const c = L(session.lang);
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState('');
  const [miss, setMiss] = useState('');
  const tampered = records.some((r) => r.tamperOrig);

  async function run() {
    setBusy(true);
    setRows([]);
    const sorted = [...records].sort((a, b) => a.seq - b.seq);
    let prev = '0'.repeat(64);
    const out: Row[] = [];
    for (const r of sorted) {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, r.prevHash + '|' + sealPayload(r));
      const link = r.prevHash === prev;
      const content = hash === r.hash;
      out.push({
        id: r.id,
        seq: r.seq,
        name: r.suspect.name,
        hash: r.hash,
        ok: link && content,
        why: link && content ? 'intact' : !content ? 'content' : 'chain',
      });
      prev = r.hash;
      setRows([...out]);
      await new Promise((res) => setTimeout(res, 120));
    }
    setBusy(false);
  }

  const bad = rows?.filter((r) => !r.ok).length ?? 0;
  const whyText = (why: Why) => (why === 'intact' ? c.intact : why === 'content' ? c.contentChanged : c.chainBroken);

  return (
    <Screen>
      <View style={styles.bar}>
        <Text style={styles.h}>{c.verify}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.sub}>{c.verifySub}</Text>
        <View style={{ marginTop: 16 }}>
          <Btn kind="dark" icon="shield" label={busy ? c.checking : c.verifyAll(records.length)} disabled={busy} onPress={run} />
        </View>
        {rows && rows.length === records.length ? (
          <View style={[styles.banner, { backgroundColor: bad ? C.posSoft : C.negSoft }]}>
            <View style={[styles.bi, { backgroundColor: bad ? C.pos : C.neg }]}>
              <Icon name={bad ? 'alert' : 'shield'} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{bad ? c.failedN(bad) : c.allIntact(rows.length)}</Text>
              <Text style={styles.meta}>{bad ? c.modifiedAfter : c.noneChanged}</Text>
            </View>
          </View>
        ) : null}
        {rows && rows.length ? (
          <View style={styles.card}>
            {rows.map((r) => (
              <View key={r.id} style={styles.vrow}>
                <View style={[styles.vic, { backgroundColor: r.ok ? C.neg : C.pos }]}>
                  <Icon name={r.ok ? 'check' : 'x'} size={13} color="#fff" strokeWidth={3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>#{r.seq} {r.name}</Text>
                  <Text style={styles.hash}>{shortHash(r.hash)}</Text>
                </View>
                <Text style={{ color: r.ok ? C.neg : C.pos, fontWeight: '700', fontSize: 12 }}>{whyText(r.why)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.section}>{c.tamperTitle}</Text>
        <View style={styles.filled}>
          <Text style={styles.meta}>{c.tamperBody}</Text>
          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            {tampered ? (
              <Btn kind="outline" icon="refresh" label={c.restore} onPress={restoreTamper} />
            ) : (
              <Btn kind="outline" icon="alert" label={c.tamperBtn} onPress={tamperOne} />
            )}
          </View>
        </View>
        <Text style={styles.section}>{c.lookupTitle}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="NL-2026-DEL-01045" value={lookup} onChangeText={setLookup} autoCapitalize="characters" /></View>
          <Pressable
            style={styles.find}
            onPress={() => {
              const q = lookup.trim().toUpperCase();
              const hit = records.find((r) => r.id === q || r.id.endsWith(q));
              if (hit) router.push({ pathname: '/record', params: { id: hit.id } });
              else setMiss('miss');
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{c.find}</Text>
          </Pressable>
        </View>
        {miss ? <Text style={{ color: C.pos, marginTop: 8 }}>{c.noId}</Text> : null}
      </ScrollView>
      <Nav />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68, justifyContent: 'center', paddingHorizontal: 16 },
  h: { fontSize: 26, fontWeight: '700', color: C.ink },
  sub: { color: C.muted, fontSize: 14, lineHeight: 20 },
  banner: { marginTop: 14, borderRadius: R.card, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  bi: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { color: C.ink2, fontSize: 13, marginTop: 2, lineHeight: 18 },
  card: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, paddingHorizontal: 16 },
  vrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  vic: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hash: { color: C.muted, fontSize: 12, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  filled: { backgroundColor: C.surface, borderRadius: R.card, padding: 16 },
  find: { height: 56, paddingHorizontal: 18, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
