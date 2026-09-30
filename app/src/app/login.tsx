import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Chrome';
import { Mark } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';

export default function Login() {
  const { signIn, session, updateSession } = useApp();
  const router = useRouter();
  const [badge, setBadge] = useState('NCB-DEL-4082');
  const [pin, setPin] = useState('1234');
  const [err, setErr] = useState('');
  const c = L(session.lang);

  async function go() {
    const message = await signIn(badge, pin);
    if (message) setErr(message);
    else router.replace('/home');
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Mark size={40} />
        <Text style={styles.h}>{c.signIn}</Text>
        <Text style={styles.sub}>{c.signInSub}</Text>
        <Text style={styles.float}>{c.badge}</Text>
        <TextInput value={badge} onChangeText={setBadge} autoCapitalize="characters" style={styles.input} />
        <Text style={styles.float}>{c.pin}</Text>
        <TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={4} style={styles.input} />
        <Text style={styles.hint}>Demo: NCB-DEL-4082 or NCB-DEL-3127 · PIN 1234</Text>
        <Text style={styles.field}>{c.language}</Text>
        <View style={styles.chips}>
          {([['en', 'English'], ['hi', 'हिंदी']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => updateSession({ lang: k })} style={[styles.chip, session.lang === k && styles.chipOn]}>
              <Text style={{ color: session.lang === k ? C.onBrand : C.ink2, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable style={styles.go} onPress={go}>
          <Text style={styles.goText}>{c.signIn}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 24 },
  h: { fontSize: 28, fontWeight: '700', color: C.ink, marginTop: 16 },
  sub: { color: C.muted, marginTop: 6 },
  float: { marginTop: 16, marginBottom: 6, color: C.ink2, fontSize: 13, fontWeight: '600' },
  input: { height: 56, borderRadius: R.input, borderWidth: 1, borderColor: C.outline, paddingHorizontal: 16, fontSize: 16, color: C.ink },
  hint: { color: C.muted, fontSize: 12, marginTop: 6, marginLeft: 4 },
  field: { marginTop: 18, marginBottom: 8, fontWeight: '600', color: C.ink2 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: C.brandSoft, borderColor: 'transparent' },
  err: { color: C.pos, marginTop: 10 },
  go: { marginTop: 28, height: 52, borderRadius: 26, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
