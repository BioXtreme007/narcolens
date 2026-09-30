import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentFlow } from '@/components/DocumentFlow';
import { L } from '@/lib/i18n';
import { Icon, PrahariMark } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { API_URL } from '@/config';
import { publishCase } from '@/lib/case';
import { prahariReply, remoteChat, remoteStt, remoteTts } from '@/lib/prahari';
import { useApp } from '@/lib/store';
import type { DocField } from '@/lib/ocr';

type Msg = { who: 'me' | 'bot'; text: string };

function suggestions(path: string, c: ReturnType<typeof L>) {
  if (path.startsWith('/scan')) return c.sugScan;
  if (path === '/record') return c.sugRecord;
  if (path === '/logs') return c.sugLogs;
  if (path === '/verify') return c.sugVerify;
  if (path === '/insights') return c.sugInsights;
  return c.sugHome;
}

function screenName(path: string, c: ReturnType<typeof L>) {
  if (path === '/home') return c.home;
  if (path.startsWith('/scan')) return c.newTest;
  if (path === '/logs') return c.audit;
  if (path === '/record') return c.testRecord;
  if (path === '/insights') return c.insights;
  if (path === '/verify') return c.verify;
  if (path === '/profile') return c.profile;
  return 'NarcoLens';
}

export function PrahariSheet() {
  const { prahariOpen, setPrahariOpen, prahariSeed, prahariFocus, clearPrahariSeed, session, records, updateSession } = useApp();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [docs, setDocs] = useState(false);
  const copy = L(session.lang);
  const [chat, setChat] = useState<Msg[]>([{ who: 'bot', text: copy.prahariHi }]);
  const [link, setLink] = useState<'off' | 'nokey' | 'live'>('off');
  const asked = useRef<string | null>(null);
  const liveRef = useRef(false);
  const recording = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  liveRef.current = link === 'live';

  async function speakOut(line: string) {
    if (!(session.voice || mode === 'voice')) return;
    Speech.stop();
    if (API_URL && liveRef.current) {
      try {
        const audio = await remoteTts(API_URL, line, session.lang);
        if (Platform.OS === 'web') {
          const El = (globalThis as unknown as { Audio: new (src: string) => { play: () => Promise<void> } }).Audio;
          await new El(`data:audio/mpeg;base64,${audio}`).play();
          return;
        }
        const file = new File(Paths.cache, 'prahari-reply.mp3');
        if (file.exists) file.delete();
        file.create();
        file.write(audio, { encoding: 'base64' });
        const player = createAudioPlayer(file.uri);
        player.play();
        setTimeout(() => player.remove(), 60000);
        return;
      } catch {
        // Bulbul did not answer; the phone voice speaks the same line.
      }
    }
    Speech.speak(line.slice(0, 400), { language: session.lang === 'hi' ? 'hi-IN' : 'en-IN' });
  }

  async function ask(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    setText('');
    setSaid(message);
    const history = chat.slice(-8).map((m) => ({ role: m.who === 'me' ? 'user' as const : 'assistant' as const, content: m.text }));
    setChat((c) => [...c, { who: 'me', text: message }]);
    setBusy(true);
    const focus = records.find((r) => r.id === prahariFocus) ?? null;
    const local = prahariReply(message, session.lang, records, focus);
    let spoken = local.text;
    let action = local.action;
    if (API_URL && liveRef.current) {
      try {
        spoken = await remoteChat(API_URL, message, session.lang, history);
      } catch {
        spoken = L(session.lang).offlineAnswer + local.text;
      }
    }
    setChat((c) => [...c, { who: 'bot', text: spoken }]);
    setBusy(false);
    void speakOut(spoken);
    const reply = { text: spoken, action };
    if (reply.action === 'doc') {
      setDocs(true);
    } else if (reply.action === 'scan') {
      setPrahariOpen(false);
      router.push('/scan');
    } else if (reply.action === 'logs') {
      setPrahariOpen(false);
      router.push('/logs');
    } else if (reply.action === 'home') {
      setPrahariOpen(false);
      router.push('/home');
    }
  }

  useEffect(() => {
    if (!API_URL) {
      setLink('off');
      return;
    }
    let stop = false;
    fetch(API_URL + '/health')
      .then((r) => r.json())
      .then((j: { ok?: boolean; sarvam?: boolean }) => {
        if (!stop) setLink(j.sarvam ? 'live' : j.ok ? 'nokey' : 'off');
      })
      .catch(() => {
        if (!stop) setLink('off');
      });
    return () => {
      stop = true;
    };
  }, [prahariOpen]);

  useEffect(() => {
    setChat((cur) => {
      if (cur.length !== 1 || cur[0].who !== 'bot') return cur;
      const text = L(session.lang).prahariHi;
      return cur[0].text === text ? cur : [{ who: 'bot', text }];
    });
  }, [session.lang]);

  useEffect(() => {
    if (!prahariOpen) {
      asked.current = null;
      setDocs(false);
      return;
    }
    if (!prahariSeed || asked.current === prahariSeed) return;
    asked.current = prahariSeed;
    const seed = prahariSeed;
    clearPrahariSeed();
    void ask(seed);
    // ask closes over the latest chat; seeding once per open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prahariOpen, prahariSeed]);

  async function finishClip() {
    if (!recording.current) return;
    recording.current = false;
    const copyNow = L(session.lang);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('empty');
      setSaid(copyNow.hearing);
      const clip = await clipToBase64(uri);
      const line = await remoteStt(API_URL, clip.b64, clip.mime, session.lang);
      setMode('chat');
      void ask(line);
    } catch {
      setSaid(copyNow.noHear);
    }
  }

  async function listen() {
    if (!(API_URL && liveRef.current)) {
      listenBrowser();
      return;
    }
    if (recording.current) {
      await finishClip();
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setSaid(L(session.lang).noVoice);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    recording.current = true;
    setSaid(L(session.lang).listeningTap);
    setTimeout(() => { void finishClip(); }, 12000);
  }

  function listenBrowser() {
    const SR = (globalThis as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
      ?? (globalThis as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition;
    if (!SR) {
      setSaid(L(session.lang).noVoice);
      return;
    }
    const rec = new SR();
    rec.lang = session.lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.onresult = (ev) => {
      const line = ev.results?.[0]?.[0]?.transcript ?? '';
      if (line) {
        setMode('chat');
        void ask(line);
      }
    };
    rec.onerror = () => setSaid(L(session.lang).noHear);
    setSaid(L(session.lang).listeningTap);
    rec.start();
  }

  const lastBot = [...chat].reverse().find((m) => m.who === 'bot')?.text ?? '';

  return (
    <Modal visible={prahariOpen} animationType="slide" transparent onRequestClose={() => setPrahariOpen(false)}>
      <Pressable style={styles.scrim} onPress={() => setPrahariOpen(false)} />
      <View style={[styles.sheet, !docs && styles.sheetTall, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.grab} />
        {docs ? (
          <DocumentFlow
            initial="pick"
            backend={API_URL}
            lang={session.lang}
            applyLabel={path.startsWith('/scan') ? L(session.lang).docFill : L(session.lang).docStart}
            onClose={() => setDocs(false)}
            onApply={(fields: DocField[]) => {
              publishCase(Object.fromEntries(fields.map((field) => [field.key, field.value])));
              const stay = path.startsWith('/scan');
              setTimeout(() => {
                setDocs(false);
                setPrahariOpen(false);
                if (!stay) router.push('/scan');
              }, 80);
            }}
          />
        ) : (
        <>
        <View style={styles.head}>
          <PrahariMark size={40} mood={busy ? 'speak' : mode === 'voice' ? 'listen' : 'idle'} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Prahari</Text>
            <Text style={styles.sub}>{link === 'live' ? copy.live : link === 'nokey' ? copy.noKey : copy.onDevice}</Text>
          </View>
          <Pressable style={styles.lang} onPress={() => updateSession({ lang: session.lang === 'hi' ? 'en' : 'hi' })}>
            <Text style={{ fontWeight: '700', color: C.ink2 }}>{session.lang === 'hi' ? 'हिंदी' : 'English'}</Text>
          </Pressable>
          <Pressable onPress={() => setPrahariOpen(false)} hitSlop={12}>
            <Icon name="x" color={C.ink2} />
          </Pressable>
        </View>
        <View style={styles.seg}>
          <Pressable style={[styles.segBtn, mode === 'chat' && styles.segOn]} onPress={() => setMode('chat')}>
            <Icon name="keyboard" size={18} color={mode === 'chat' ? C.onBrand : C.ink2} />
            <Text style={{ fontWeight: '700', color: mode === 'chat' ? C.onBrand : C.ink2 }}>{copy.chat}</Text>
          </Pressable>
          <Pressable style={[styles.segBtn, mode === 'voice' && styles.segOn]} onPress={() => setMode('voice')}>
            <Icon name="mic" size={18} color={mode === 'voice' ? C.onBrand : C.ink2} />
            <Text style={{ fontWeight: '700', color: mode === 'voice' ? C.onBrand : C.ink2 }}>{copy.voice}</Text>
          </Pressable>
        </View>
        {mode === 'chat' ? (
          <>
            <FlatList
              data={chat}
              keyExtractor={(_, i) => String(i)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              ListHeaderComponent={<Text style={styles.ctx}>{copy.youreOn(screenName(path, copy))}</Text>}
              renderItem={({ item }) => (
                <View style={[styles.bubble, item.who === 'me' ? styles.me : styles.bot]}>
                  <Text style={{ color: item.who === 'me' ? '#fff' : C.ink, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
                </View>
              )}
            />
            <View style={styles.suggest}>
              {suggestions(path, copy).map((s) => (
                <Pressable key={s} onPress={() => ask(s)} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.composer}>
              <Pressable hitSlop={8} onPress={() => setDocs(true)} accessibilityLabel={copy.readDoc}>
                <Icon name="doc" color={C.ink2} />
              </Pressable>
              <View style={styles.field}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={copy.askPrahari}
                  placeholderTextColor={C.muted}
                  style={styles.input}
                  onSubmitEditing={() => ask(text)}
                />
                <Pressable onPress={() => setMode('voice')} hitSlop={8}>
                  <Icon name="mic" size={20} color={C.ink2} />
                </Pressable>
              </View>
              <Pressable style={styles.send} onPress={() => ask(text)}>
                <Icon name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.voice}>
            <PrahariMark size={150} mood={busy ? 'speak' : 'listen'} />
            <Text style={styles.said}>{said || copy.tapMic}</Text>
            <Text style={styles.reply}>{lastBot}</Text>
            <Pressable style={styles.mic} onPress={listen}>
              <Icon name="mic" size={30} color="#fff" />
            </Pressable>
            <Text style={styles.sub}>{copy.commands}</Text>
          </View>
        )}
        </>
        )}
      </View>
    </Modal>
  );
}

async function clipToBase64(uri: string): Promise<{ b64: string; mime: string }> {
  if (Platform.OS === 'web' || uri.startsWith('blob:')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { b64, mime: blob.type || 'audio/webm' };
  }
  return { b64: await new File(uri).base64(), mime: 'audio/mp4' };
}

type SpeechRec = {
  lang: string;
  start: () => void;
  onresult: ((ev: { results?: { 0?: { 0?: { transcript?: string } } } }) => void) | null;
  onerror: (() => void) | null;
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetTall: { height: '86%' },
  grab: { width: 32, height: 4, borderRadius: 2, backgroundColor: C.outline, alignSelf: 'center', marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 17, fontWeight: '700', color: C.ink },
  sub: { fontSize: 12, color: C.muted },
  lang: { borderWidth: 1, borderColor: C.outline, borderRadius: 8, paddingHorizontal: 10, height: 32, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', marginHorizontal: 20, borderWidth: 1, borderColor: C.outline, borderRadius: 20, overflow: 'hidden' },
  segBtn: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segOn: { backgroundColor: C.brandSoft },
  ctx: { alignSelf: 'center', fontSize: 12, color: C.muted, backgroundColor: C.surface, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '600', overflow: 'hidden' },
  bubble: { maxWidth: '84%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  me: { alignSelf: 'flex-end', backgroundColor: C.ink, borderBottomRightRadius: 6 },
  bot: { alignSelf: 'flex-start', backgroundColor: C.surface, borderBottomLeftRadius: 6 },
  suggest: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: C.outline, borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, color: C.ink2 },
  composer: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 26, backgroundColor: C.surface, paddingLeft: 16, paddingRight: 10 },
  input: { flex: 1, color: C.ink, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  voice: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  said: { color: C.muted, fontSize: 15, textAlign: 'center' },
  reply: { fontSize: 17, fontWeight: '600', textAlign: 'center', lineHeight: 24 },
  mic: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
});
