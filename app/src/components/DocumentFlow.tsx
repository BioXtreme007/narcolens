import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Chrome';
import { Icon } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { L, type Lang } from '@/lib/i18n';
import { fieldsFor, parseDoc, readDocument, SAMPLE_TEXT, type DocField, type DocKind } from '@/lib/ocr';

type Phase = 'pick' | 'fir' | 'kit' | 'camera' | 'review' | 'reading' | 'result';

export function DocumentFlow({
  initial,
  backend,
  applyLabel,
  lang = 'en',
  onClose,
  onApply,
}: {
  initial: 'pick' | DocKind;
  backend?: string;
  applyLabel: string;
  lang?: Lang;
  onClose: () => void;
  onApply: (fields: DocField[]) => void;
}) {
  const copy = L(lang);
  const [phase, setPhase] = useState<Phase>(initial);
  const [kind, setKind] = useState<DocKind>(initial === 'kit' ? 'kit' : 'fir');
  const [found, setFound] = useState<DocField[]>([]);
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [openRaw, setOpenRaw] = useState(false);
  const [status, setStatus] = useState('Reading document…');
  const [hint, setHint] = useState('');
  const [shotUri, setShotUri] = useState<string | null>(null);
  const cam = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [camReady, setCamReady] = useState(false);

  function choose(next: DocKind) {
    setKind(next);
    setPhase(next);
  }

  async function finish(text: string, extra?: string) {
    const rows = fieldsFor(kind, parseDoc(text));
    setFound(rows);
    setRaw(text.trim());
    setNote(extra ?? '');
    setPhase('result');
  }

  async function sample() {
    setStatus(copy.docSampleStatus);
    setPhase('reading');
    await finish(SAMPLE_TEXT[kind]);
  }

  function holdPhoto(uri: string) {
    setShotUri(uri);
    setHint('');
    setPhase('review');
  }

  async function readPhoto(uri: string) {
    setStatus(backend ? copy.docSending : copy.docReadingPhoto);
    setPhase('reading');
    const started = Date.now();
    const read = await readDocument(uri, kind, backend, lang);
    const pause = 1100 - (Date.now() - started);
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
    await finish(read.text, read.note);
  }

  async function upload() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    holdPhoto(res.assets[0].uri);
  }

  async function openCamera() {
    if (!camPerm?.granted) {
      const next = await requestCam();
      if (!next.granted) {
        setHint(copy.docCamDenied);
        setPhase(kind);
        return;
      }
    }
    setCamReady(false);
    setPhase('camera');
  }

  async function shoot() {
    if (!cam.current || !camReady) {
      setHint(copy.docCamWait);
      return;
    }
    const shot = await cam.current.takePictureAsync({ quality: 0.7, shutterSound: false });
    if (shot?.uri) holdPhoto(shot.uri);
  }

  if (phase === 'pick') {
    return (
      <View style={styles.body}>
        <Text style={styles.h}>{copy.docPickTitle}</Text>
        <Text style={styles.sub}>{copy.docPickSub}</Text>
        <Option icon="doc" title={copy.docFirOpt} detail={copy.docFirOptSub} onPress={() => choose('fir')} />
        <Option icon="flask" title={copy.docKitOpt} detail={copy.docKitOptSub} onPress={() => choose('kit')} />
      </View>
    );
  }

  if (phase === 'camera') {
    return (
      <View style={styles.body}>
        <Text style={styles.h}>{kind === 'kit' ? copy.docKitTitle : copy.docFirTitle}</Text>
        <Text style={styles.sub}>{copy.docFrame}</Text>
        <View style={styles.preview}>
          <CameraView
            ref={cam}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            animateShutter={false}
            onCameraReady={() => setCamReady(true)}
          />
        </View>
        {hint ? <Text style={styles.sub}>{hint}</Text> : null}
        <View style={{ marginTop: 16 }}>
          <Btn kind="dark" icon="camera" label={camReady ? copy.docShutter : copy.docOpening} onPress={shoot} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Btn kind="tonal" label={copy.back} onPress={() => setPhase(kind)} />
        </View>
      </View>
    );
  }

  if (phase === 'review' && shotUri) {
    return (
      <View style={styles.body}>
        <Text style={styles.h}>{copy.docCaptured}</Text>
        <Text style={styles.sub}>{copy.docCheck}</Text>
        <View style={[styles.preview, styles.previewTall]}>
          <Image source={{ uri: shotUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        </View>
        <View style={{ marginTop: 16 }}>
          <Btn kind="dark" icon="scan" label={copy.docRead} onPress={() => readPhoto(shotUri)} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Btn kind="tonal" icon="camera" label={copy.retake} onPress={openCamera} />
        </View>
      </View>
    );
  }

  if (phase === 'reading') {
    return (
      <View style={styles.body}>
        <Text style={styles.h}>{copy.docReading}</Text>
        {shotUri ? (
          <View style={styles.preview}>
            <Image source={{ uri: shotUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
        ) : null}
        <View style={styles.row}>
          <ActivityIndicator color={C.brand} />
          <Text style={{ fontWeight: '600', color: C.ink, flex: 1 }}>{status}</Text>
        </View>
      </View>
    );
  }

  if (phase === 'result') {
    const empty = found.length === 0;
    return (
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.ok, empty && styles.warn]}>
            <Icon name={empty ? 'alert' : 'check'} size={18} color={empty ? '#5B3A00' : '#fff'} strokeWidth={empty ? 2.4 : 3} />
          </View>
          <Text style={styles.h}>{empty ? (note === copy.docBlack ? copy.docBlackTitle : copy.docNothing) : copy.docFound(found.length)}</Text>
        </View>
        {shotUri ? (
          <View style={[styles.preview, styles.previewTall]}>
            <Image source={{ uri: shotUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
        ) : null}
        {note ? <Text style={styles.sub}>{note}</Text> : null}
        {empty && note === copy.docBlack ? null : <View style={styles.card}>
          {empty ? (
            <Text style={styles.sub}>{copy.docEmpty(kind === 'kit')}</Text>
          ) : (
            found.map((field) => (
              <View key={field.key} style={styles.kv}>
                <Text style={styles.k}>{field.label}</Text>
                <Text style={styles.v}>{field.value}</Text>
              </View>
            ))
          )}
        </View>}
        <Pressable onPress={() => setOpenRaw((v) => !v)} style={styles.rawBtn}>
          <Text style={styles.rawMark}>{openRaw ? '▼' : '▶'}</Text>
          <Text style={styles.rawLabel}>{copy.docRaw}</Text>
        </Pressable>
        {openRaw ? <Text style={styles.raw}>{raw || '—'}</Text> : null}
        {found.length ? (
          <View style={{ marginTop: 16 }}>
            <Btn kind="dark" label={applyLabel} onPress={() => onApply(found)} />
          </View>
        ) : shotUri ? (
          <View style={{ marginTop: 16 }}>
            <Btn kind="dark" icon="camera" label={copy.docAnother} onPress={openCamera} />
          </View>
        ) : null}
        <View style={{ marginTop: 10 }}>
          <Btn kind="tonal" label={copy.close} onPress={onClose} />
        </View>
      </View>
    );
  }

  const kit = phase === 'kit';
  return (
    <View style={styles.body}>
      <Text style={styles.h}>{kit ? copy.scanKit : copy.scanFir}</Text>
      <Text style={styles.sub}>
        {kit ? copy.docKitBody : copy.docFirBody}{' '}
        {backend ? copy.docServerOn : copy.docServerOff}
      </Text>
      {hint ? <Text style={styles.sub}>{hint}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Btn kind="dark" icon="camera" label={copy.docTake} onPress={openCamera} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Btn kind="tonal" icon="upload" label={copy.docUpload} onPress={upload} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Btn kind="tonal" icon="doc" label={copy.docSample} onPress={sample} />
      </View>
    </View>
  );
}

function Option({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable style={styles.opt} onPress={onPress}>
      <Icon name={icon} color={C.ink2} />
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        <Text style={styles.optDetail}>{detail}</Text>
      </View>
      <Icon name="chev" color={C.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8 },
  h: { fontSize: 22, fontWeight: '700', color: C.ink, flexShrink: 1 },
  sub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 10 },
  optTitle: { fontSize: 16, fontWeight: '500', color: C.ink },
  optDetail: { fontSize: 13, color: C.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  ok: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.neg, alignItems: 'center', justifyContent: 'center' },
  warn: { backgroundColor: C.warnSoft },
  previewTall: { height: 320 },
  card: { marginTop: 14, backgroundColor: C.surface, borderRadius: R.card, paddingHorizontal: 16, paddingVertical: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  k: { color: C.muted, fontSize: 14 },
  v: { color: C.ink, fontWeight: '600', fontSize: 14, flexShrink: 1, textAlign: 'right' },
  rawBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  rawMark: { color: C.muted, fontSize: 12 },
  rawLabel: { color: C.muted, fontWeight: '700', fontSize: 13 },
  raw: { marginTop: 8, backgroundColor: C.surface, borderRadius: 10, padding: 10, color: C.ink2, fontSize: 12, lineHeight: 18 },
  preview: { marginTop: 14, height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#141517' },
});
