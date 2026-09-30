import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, FlowBar, PrahariFloat, Screen } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { Icon } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { L, type Lang } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { drugText, fmtDate, fmtTime, sealPayload, shortHash, type AuditRecord } from '@/lib/types';
import { REAGENTS } from '@/ml/engine';

type Copy = ReturnType<typeof L>;

function tone(status: string, c: Copy) {
  if (status === 'POSITIVE') return { bg: C.pos, soft: C.posSoft, fg: C.pos, icon: 'excl' as const, head: c.drugDetected, label: c.detected };
  if (status === 'NEGATIVE') return { bg: C.neg, soft: C.negSoft, fg: C.neg, icon: 'check' as const, head: c.testComplete, label: c.notDetected };
  return { bg: C.warn, soft: C.warnSoft, fg: C.warn, icon: 'q' as const, head: c.needsRetest, label: c.unclear };
}

function reasonLabel(stored: string, c: Copy) {
  const known = c.reasonEn.indexOf(stored);
  if (known >= 0) return c.reasons[known];
  const shown = c.reasons.indexOf(stored);
  return shown >= 0 ? c.reasons[shown] : stored;
}

function showEvent(e: string, c: Copy) {
  if (e === 'Test recorded & sealed') return c.evSealed;
  if (e === 'Officer confirmed result') return c.evConfirmed;
  if (e === 'Officer verdict withdrawn') return c.evUndo;
  const prefix = 'Officer disputed result: ';
  if (e.startsWith(prefix)) return c.evDisputed + reasonLabel(e.slice(prefix.length), c);
  return e;
}

function shareRecord(r: AuditRecord, c: Copy, lang: Lang) {
  const text = `NarcoLens ${r.id}\n${drugText(r, lang)} (${c.confOf(r.overall.conf)}, ${c.presumptive})\n${c.suspect}: ${r.suspect.name}\n${c.testedBy}: ${r.officer.name} (${r.officer.badge})\n${fmtDate(r.createdAt, lang)} ${fmtTime(r.createdAt, lang)} · ${r.location.place}\n${r.hash}`;
  Share.share({ message: text, title: r.id }).catch(() => {});
}

export default function RecordScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { records, setVerdict, openPrahari, verifyChain, session } = useApp();
  const c = L(session.lang);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const r = records.find((x) => x.id === id);
  const [ask, setAsk] = useState(false);
  const [why, setWhy] = useState(c.reasonEn[0]);
  const [fp, setFp] = useState(false);
  const [intact, setIntact] = useState<boolean | null>(null);

  useEffect(() => {
    if (!r) return;
    let live = true;
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, r.prevHash + '|' + sealPayload(r)).then((hash) => {
      const link = verifyChain().find((v) => v.id === r.id)?.ok ?? false;
      if (live) setIntact(hash === r.hash && link);
    });
    return () => {
      live = false;
    };
  }, [r, verifyChain]);

  if (!r) {
    return (
      <Screen>
        <Text style={{ padding: 24 }}>{c.missing}</Text>
      </Screen>
    );
  }

  const t = tone(r.overall.status, c);
  const result = from === 'scan';
  const confLine = `${r.overall.status === 'INCONCLUSIVE' ? c.noClear : c.confOf(r.overall.conf)} · ${c.presumptive}`;

  if (result) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.frame}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={[styles.resTop, { backgroundColor: t.soft }]}>
              <View style={[styles.bigIc, { backgroundColor: t.bg }]}>
                <Icon name={t.icon} size={46} color="#fff" strokeWidth={3} />
              </View>
              <Text style={[styles.overline, { color: t.fg }]}>{t.head}</Text>
              <Text style={styles.resDrug}>{drugText(r, session.lang)}</Text>
              <Text style={styles.resMeta}>{confLine} · {fmtTime(r.createdAt, session.lang)}</Text>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {r.photoUri ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.meta}>{c.scannedPlate}</Text>
                  <Image source={{ uri: r.photoUri }} style={styles.plate} resizeMode="contain" />
                </View>
              ) : (
                <Text style={[styles.meta, { marginTop: 14 }]}>{c.noCameraPhoto}</Text>
              )}
              {r.overall.status === 'INCONCLUSIVE' ? (
                <View style={styles.warnNote}>
                  <Icon name="alert" size={18} color="#5B3A00" />
                  <Text style={styles.warnTxt}>{c.unclearWarn}</Text>
                </View>
              ) : null}
              <View style={styles.card}>
                {r.wells.map((w, i) => (
                  <View key={i} style={styles.well}>
                    <View style={[styles.bigSw, { backgroundColor: w.hex }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wellName}>{i + 1} · {REAGENTS[w.reagentId]?.name ?? w.reagentId}</Text>
                      <Text style={styles.meta}>{w.colour}{w.drug ? ` → ${w.drug}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.badge, { backgroundColor: tone(w.status, c).soft, color: tone(w.status, c).fg }]}>{tone(w.status, c).label}</Text>
                      <Text style={styles.conf}>{w.conf}%</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Verdict c={c} r={r} ask={ask} why={why} setAsk={setAsk} setWhy={setWhy} onYes={() => setVerdict(r.id, { confirmed: true })} onSave={() => { setVerdict(r.id, { disputed: why }); setAsk(false); }} onUndo={() => setVerdict(r.id, { undo: true })} />
              <Pressable style={styles.fp} onPress={() => setFp((v) => !v)}>
                <Icon name="alert" size={18} color={C.ink2} />
                <Text style={{ flex: 1, fontWeight: '500' }}>{c.fpTitle}</Text>
                <View style={{ transform: [{ rotate: fp ? '180deg' : '0deg' }] }}><Icon name="chevd" size={18} color={C.ink2} /></View>
              </Pressable>
              {fp ? (
                <View style={styles.fpBody}>
                  {c.fpItems.map((line) => <Text key={line} style={styles.fpLi}>{line}</Text>)}
                </View>
              ) : null}
              <View style={[styles.card, { marginTop: 12 }]}>
                <Kv k={c.suspect} v={`${r.suspect.name}${r.suspect.age ? `, ${r.suspect.age}` : ''}`} />
                <Kv k={c.testId} v={r.id} mono />
                <Kv k={c.testedBy} v={r.officer.name} />
                <Kv k={c.dateTime} v={`${fmtDate(r.createdAt, session.lang)}, ${fmtTime(r.createdAt, session.lang)}`} />
                <Kv k={c.location} v={r.location.place} />
                <Kv k={c.lighting} v={r.light} />
              </View>
              <View style={styles.seal}>
                <Icon name="lock" size={20} color={C.neg} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14 }}>{c.sealed}</Text>
                  <Text style={styles.mono}>SHA-256 {shortHash(r.hash)}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                <View style={{ flex: 1 }}><Btn kind="tonal" icon="share" label={c.share} onPress={() => shareRecord(r, c, session.lang)} /></View>
                <View style={{ flex: 1 }}><Btn kind="tonal" icon="refresh" label={c.retest} onPress={() => router.replace({ pathname: '/scan', params: { retest: '1' } })} /></View>
              </View>
              <Text style={styles.foot}>{c.fieldFoot}</Text>
            </View>
          </ScrollView>
          <FlowBar hideBack onBack={() => router.replace('/home')}>
            <Btn kind="dark" label={c.done} onPress={() => router.replace('/home')} />
          </FlowBar>
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><Icon name="back" color={C.ink2} /></Pressable>
        <Text style={styles.appTitle}>{c.testRecord}</Text>
        <Pressable style={styles.iconBtn} onPress={() => shareRecord(r, c, session.lang)}><Icon name="share" color={C.ink2} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <View style={[styles.banner, { backgroundColor: t.soft }]}>
          <View style={[styles.bi, { backgroundColor: t.bg }]}><Icon name={t.icon} size={26} color="#fff" strokeWidth={3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.overline, { color: t.fg }]}>{t.label}</Text>
            <Text style={styles.titleL}>{drugText(r, session.lang)}</Text>
            <Text style={styles.meta}>{confLine}</Text>
          </View>
        </View>
        <Verdict c={c} r={r} ask={ask} why={why} setAsk={setAsk} setWhy={setWhy} onYes={() => setVerdict(r.id, { confirmed: true })} onSave={() => { setVerdict(r.id, { disputed: why }); setAsk(false); }} onUndo={() => setVerdict(r.id, { undo: true })} />
        <View style={styles.section}><Text style={styles.titleM}>{c.suspect}</Text>{r.synthetic ? <Text style={styles.dimBadge}>{c.synthetic}</Text> : null}</View>
        <View style={styles.card}>
          <Kv k={c.name} v={r.suspect.name} />
          <Kv k={c.ageGender} v={`${r.suspect.age || '—'} · ${r.suspect.gender ? c.choice(r.suspect.gender) : '—'}`} />
          <Kv k={c.firCase} v={r.fir || '—'} mono />
          <Kv k={c.material} v={r.item ? c.choice(r.item) : '—'} />
          <Kv k={c.witness} v={r.witness || '—'} />
        </View>
        <Text style={[styles.titleM, { marginTop: 22, marginBottom: 10 }]}>{c.test}</Text>
        <View style={styles.card}>
          <Kv k={c.testId} v={r.id} mono />
          <Kv k={c.dateDot} v={`${fmtDate(r.createdAt, session.lang)} · ${fmtTime(r.createdAt, session.lang)}`} />
          <Kv k={c.testedBy} v={`${r.officer.name}\n${r.officer.badge}`} />
          <Kv k={c.unit} v={r.officer.unit} />
          <Kv k={c.location} v={`${r.location.place}${r.location.lat ? `\n${r.location.lat.toFixed(4)}, ${r.location.lng?.toFixed(4)}` : ''}`} />
          <Kv k={c.kitBatch} v={`${r.kit.batch || '—'} · ${r.kit.expiry || '—'}`} mono />
          <Kv k={c.lighting} v={r.light} />
        </View>
        <Text style={[styles.titleM, { marginTop: 22, marginBottom: 10 }]}>{c.wells}</Text>
        {r.photoUri ? (
          <View>
            <Text style={styles.meta}>{c.scannedPlate}</Text>
            <Image source={{ uri: r.photoUri }} style={styles.plate} resizeMode="contain" />
          </View>
        ) : (
          <Text style={styles.meta}>{c.noCameraPhoto}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.card, { flex: 1, marginTop: 12 }]}>
            {r.wells.map((w, i) => (
              <View key={i} style={styles.well}>
                <View style={[styles.bigSw, { width: 26, height: 26, backgroundColor: w.hex }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13 }}>{i + 1} · {REAGENTS[w.reagentId]?.short ?? w.reagentId}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{w.drug || w.colour}</Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: tone(w.status, c).soft, color: tone(w.status, c).fg }]}>{w.conf}%</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.titleM}>{c.integrity}</Text>
          <Text style={[styles.dimBadge, { backgroundColor: intact ? C.negSoft : C.posSoft, color: intact ? C.neg : C.pos }]}>{intact ? c.intact : intact === false ? c.altered : '…'}</Text>
        </View>
        <View style={styles.card}>
          <Kv k={c.sequence} v={`#${r.seq}`} mono />
          <Kv k={c.recordHash} v={shortHash(r.hash)} mono />
          <Kv k={c.prevHash} v={shortHash(r.prevHash)} mono />
          <Kv k={c.photoHash} v={shortHash(r.photoHash)} mono />
        </View>
        <Text style={[styles.titleM, { marginTop: 22, marginBottom: 10 }]}>{c.timeline}</Text>
        {r.events.map((e, i) => (
          <View key={i} style={styles.tl}>
            <View style={styles.tlDot} />
            {i < r.events.length - 1 ? <View style={styles.tlLine} /> : null}
            <Text style={{ fontWeight: '500' }}>{showEvent(e.e, c)}</Text>
            <Text style={styles.meta}>{fmtDate(e.t, session.lang)}, {fmtTime(e.t, session.lang)}</Text>
          </View>
        ))}
        <Pressable style={styles.askBtn} onPress={() => openPrahari(c.sugRecord[0], r.id)}>
          <Icon name="spark" size={18} color={C.ink} />
          <Text style={{ fontWeight: '700' }}>{c.askAbout}</Text>
        </Pressable>
      </ScrollView>
      <PrahariFloat />
    </Screen>
  );
}

function Verdict({
  c, r, ask, why, setAsk, setWhy, onYes, onSave, onUndo,
}: {
  c: Copy;
  r: AuditRecord;
  ask: boolean;
  why: string;
  setAsk: (v: boolean) => void;
  setWhy: (v: string) => void;
  onYes: () => void;
  onSave: () => void;
  onUndo: () => void;
}) {
  if (r.confirmed) {
    return (
      <View style={styles.verdictRow}>
        <View style={[styles.lead, { backgroundColor: C.negSoft }]}><Icon name="check" size={20} color={C.neg} strokeWidth={2.6} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleM}>{c.confirmedYou}</Text>
          <Text style={styles.meta}>{c.loggedIn}</Text>
        </View>
        <Pressable onPress={onUndo}><Text style={styles.undo}>{c.undo}</Text></Pressable>
      </View>
    );
  }
  if (r.disputed) {
    return (
      <View style={styles.verdictRow}>
        <View style={[styles.lead, { backgroundColor: C.warnSoft }]}><Icon name="alert" size={20} color={C.warn} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleM}>{c.disputedYou}</Text>
          <Text style={styles.meta}>{reasonLabel(r.disputed, c)}</Text>
        </View>
        <Pressable onPress={onUndo}><Text style={styles.undo}>{c.undo}</Text></Pressable>
      </View>
    );
  }
  if (ask) {
    return (
      <View style={styles.verdict}>
        <Text style={styles.titleM}>{c.mismatch}</Text>
        {c.reasonEn.map((stored, i) => (
          <Pressable key={stored} style={styles.radio} onPress={() => setWhy(stored)}>
            <View style={[styles.radioDot, why === stored && styles.radioOn]} />
            <Text>{c.reasons[i]}</Text>
          </Pressable>
        ))}
        <View style={styles.grid}>
          <View style={{ flex: 1 }}><Btn kind="tonal" label={c.cancel} onPress={() => setAsk(false)} /></View>
          <View style={{ flex: 1 }}><Btn kind="dark" label={c.save} onPress={onSave} /></View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.verdict}>
      <Text style={styles.titleM}>{c.matchQ}</Text>
      <Text style={styles.meta}>{c.matchSub}</Text>
      <View style={styles.grid}>
        <View style={{ flex: 1 }}><Btn kind="pos" icon="down" label={c.no} onPress={() => setAsk(true)} /></View>
        <View style={{ flex: 1 }}><Btn kind="neg" icon="up" label={c.yesConfirm} onPress={onYes} /></View>
      </View>
    </View>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={[styles.kvV, mono && styles.mono]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 480 },
  appbar: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  appTitle: { flex: 1, fontSize: 20, fontWeight: '600' },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  resTop: { alignItems: 'center', paddingTop: 18, paddingBottom: 26, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  bigIc: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  resDrug: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center', marginTop: 4 },
  resMeta: { fontSize: 14, color: C.ink2, marginTop: 4, textAlign: 'center' },
  warnNote: { flexDirection: 'row', gap: 10, backgroundColor: C.warnSoft, borderRadius: 12, padding: 12, marginTop: 14 },
  warnTxt: { flex: 1, color: '#5B3A00', fontSize: 13, lineHeight: 18 },
  card: { marginTop: 16, borderWidth: 1, borderColor: C.line, borderRadius: R.card, paddingHorizontal: 16 },
  well: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  bigSw: { width: 40, height: 40, borderRadius: 20 },
  wellName: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 13, color: C.muted, marginTop: 2 },
  badge: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '700' },
  conf: { color: C.muted, marginTop: 4, fontSize: 12 },
  verdict: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 16 },
  verdictRow: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lead: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleM: { fontSize: 16, fontWeight: '600' },
  undo: { color: C.brand, fontWeight: '700' },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.outline },
  radioOn: { borderColor: C.brand, backgroundColor: C.brand },
  grid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  fp: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fpBody: { paddingHorizontal: 16, paddingBottom: 8 },
  fpLi: { color: C.ink2, fontSize: 13, lineHeight: 20, marginTop: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  kvK: { color: C.muted, fontSize: 14 },
  kvV: { fontWeight: '500', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  mono: { fontVariant: ['tabular-nums'], fontSize: 12 },
  seal: { marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12 },
  foot: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 14 },
  banner: { borderRadius: R.card, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  bi: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  titleL: { fontSize: 20, fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  dimBadge: { backgroundColor: C.surface2, color: C.ink2, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '700' },
  plate: { width: '100%', height: 240, borderRadius: 16, backgroundColor: '#141517', marginTop: 8 },
  tl: { paddingLeft: 26, paddingBottom: 16, position: 'relative' },
  tlDot: { position: 'absolute', left: 5, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  tlLine: { position: 'absolute', left: 9, top: 16, bottom: 0, width: 1.5, backgroundColor: C.line },
  askBtn: { marginTop: 8, height: 48, borderRadius: 24, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
