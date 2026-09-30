import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Mark, PrahariMark } from '@/components/Icon';
import { C } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';

const STORY_BG = ['#E8590C', '#7285F2', '#1F9D5B'];

function StoryArt({ index }: { index: number }) {
  if (index === 1) {
    return (
      <View style={styles.art}>
        <View style={styles.shield}>
          <Icon name="shield" size={84} color="#fff" strokeWidth={1.6} />
        </View>
        <View style={[styles.float, { left: 16, top: 54 }]}>
          <Icon name="lock" size={14} color={C.ink} />
          <Text style={styles.floatText}>a41f…9c2e</Text>
        </View>
        <View style={[styles.float, { right: 16, bottom: 36 }]}>
          <Icon name="pin" size={14} color={C.ink} />
          <Text style={styles.floatText}>Singhu Border · 12:30</Text>
        </View>
      </View>
    );
  }
  if (index === 2) {
    return (
      <View style={styles.art}>
        <PrahariMark size={130} />
        <View style={[styles.bubble, { left: 12, top: 48 }]}>
          <Text style={styles.bubbleText}>"Test B shuru karo"</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleDark, { right: 12, bottom: 28 }]}>
          <Text style={[styles.bubbleText, { color: '#fff' }]}>Add 25 drops of B2…</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.art}>
      <View style={styles.plate}>
        {['#C9361B', '#2B86CC', '#EFEADF'].map((c) => (
          <View key={c} style={[styles.well, { backgroundColor: c }]} />
        ))}
      </View>
      <View style={[styles.chipFloat, { left: 18, bottom: 28 }]}>
        <Icon name="excl" size={14} color="#fff" strokeWidth={3} />
        <Text style={styles.chipFloatText}>Cannabis · 94%</Text>
      </View>
      <View style={[styles.chipFloat, styles.chipLight, { right: 16, top: 52 }]}>
        <Icon name="spark" size={14} color={C.ink} />
        <Text style={[styles.chipFloatText, { color: C.ink }]}>Warm light corrected</Text>
      </View>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeWelcome, session, updateSession } = useApp();
  const [splash, setSplash] = useState(true);
  const [i, setI] = useState(0);
  const [bar, setBar] = useState(0);
  const scale = useSharedValue(0.2);
  const word = useSharedValue(0);
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, maxWidth: word.value * 220 }));

  useEffect(() => {
    scale.value = withSpring(1, { damping: 11, stiffness: 140 });
    word.value = withDelay(700, withTiming(1, { duration: 650 }));
    const t = setTimeout(() => setSplash(false), 2500);
    return () => clearTimeout(t);
  }, [scale, word]);

  useEffect(() => {
    if (splash || session.onboarded) return;
    setBar(0);
    const started = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / 4200);
      setBar(p);
      if (p >= 1) setI((n) => (n + 1) % STORY_BG.length);
    }, 80);
    return () => clearInterval(id);
  }, [splash, i, session.onboarded]);

  useEffect(() => {
    if (splash || !session.onboarded) return;
    router.replace(session.signedIn ? '/home' : '/login');
  }, [splash, session.onboarded, session.signedIn, router]);

  async function start() {
    await completeWelcome();
    router.replace('/login');
  }

  if (splash || session.onboarded) {
    return (
      <Pressable style={styles.splash} onPress={() => setSplash(false)}>
        <View style={styles.spRow}>
          <Animated.View style={markStyle}>
            <Mark size={64} light />
          </Animated.View>
          <Animated.Text style={[styles.word, wordStyle]} numberOfLines={1}>
            Narco<Text style={{ color: C.brand2 }}>Lens</Text>
          </Animated.Text>
        </View>
        <Text style={styles.tag}>Field drug tests, read right.</Text>
        <Text style={[styles.foot, { bottom: insets.bottom + 28 }]}>Smart India Hackathon 2026</Text>
      </Pressable>
    );
  }

  const stories = L(session.lang).stories.map((s, n) => ({ ...s, bg: STORY_BG[n] }));
  const story = stories[i];
  const copy = L(session.lang);
  return (
    <View style={[styles.welcome, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={[styles.card, { backgroundColor: story.bg }]}>
        <View style={styles.bars}>
          {stories.map((_, n) => (
            <View key={n} style={styles.bar}>
              <View style={[styles.barFill, { width: n < i ? '100%' : n === i ? `${Math.round(bar * 100)}%` : '0%' }]} />
            </View>
          ))}
        </View>
        <View style={styles.brandRow}>
          <Mark size={18} light />
          <Text style={styles.brandText}>NarcoLens</Text>
        </View>
        <StoryArt index={i} />
        <Pressable style={styles.tapL} onPress={() => setI((n) => (n + stories.length - 1) % stories.length)} />
        <Pressable style={styles.tapR} onPress={() => setI((n) => (n + 1) % stories.length)} />
      </View>
      <Text style={styles.title}>{story.title}</Text>
      <Text style={styles.body}>{story.body}</Text>
      <Pressable style={styles.go} onPress={start}>
        <Text style={styles.goText}>{copy.getStarted}</Text>
      </Pressable>
      <Pressable style={styles.lang} onPress={() => updateSession({ lang: session.lang === 'hi' ? 'en' : 'hi' })}>
        <Text style={styles.langText}>Language · {session.lang === 'hi' ? 'हिंदी' : 'English'}</Text>
      </Pressable>
      <Text style={styles.note}>{copy.offlineNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0E0F11', alignItems: 'center', justifyContent: 'center' },
  spRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { color: '#fff', fontSize: 36, fontWeight: '800', overflow: 'hidden' },
  tag: { color: '#8D9097', marginTop: 18, fontSize: 14 },
  foot: { position: 'absolute', color: '#5E6168', fontSize: 12, letterSpacing: 0.6 },
  welcome: { flex: 1, backgroundColor: '#0E0F11', paddingHorizontal: 12 },
  card: { flex: 1, maxHeight: 430, borderRadius: 28, overflow: 'hidden' },
  bars: { position: 'absolute', top: 12, left: 14, right: 14, flexDirection: 'row', gap: 5, zIndex: 2 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  brandRow: { position: 'absolute', top: 26, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 2 },
  brandText: { color: '#fff', fontWeight: '700' },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plate: { flexDirection: 'row', gap: 14, backgroundColor: '#F6F6F2', borderRadius: 34, paddingVertical: 26, paddingHorizontal: 18, transform: [{ rotate: '-6deg' }] },
  well: { width: 58, height: 58, borderRadius: 29, borderWidth: 6, borderColor: '#fff' },
  chipFloat: { position: 'absolute', backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLight: { backgroundColor: '#fff' },
  chipFloatText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  float: { position: 'absolute', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatText: { color: C.ink, fontWeight: '700', fontSize: 12 },
  shield: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  bigOrb: { width: 130, height: 130, borderRadius: 65, backgroundColor: C.brand },
  bubble: { position: 'absolute', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleDark: { backgroundColor: C.ink },
  bubbleText: { color: C.ink, fontWeight: '600', fontSize: 13 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 18, paddingHorizontal: 8 },
  body: { color: '#D7D8DC', fontSize: 15, lineHeight: 21, marginTop: 6, paddingHorizontal: 8 },
  go: { marginTop: 16, height: 52, borderRadius: 26, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  lang: { marginTop: 8, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  langText: { color: '#fff', fontWeight: '600' },
  note: { color: '#8D9097', textAlign: 'center', fontSize: 12, marginTop: 2 },
  tapL: { position: 'absolute', left: 0, top: 40, bottom: 0, width: '36%' },
  tapR: { position: 'absolute', right: 0, top: 40, bottom: 0, width: '64%' },
});
