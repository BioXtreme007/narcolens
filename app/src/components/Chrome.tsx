import * as Haptics from 'expo-haptics';
import { useRouter, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PrahariMark } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { L } from '@/lib/i18n';
import { useApp } from '@/lib/store';

export function Screen({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: dark ? C.black : C.bg }]}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

export function Btn({
  label,
  onPress,
  kind = 'dark',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'dark' | 'brand' | 'tonal' | 'outline' | 'pos' | 'neg';
  icon?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        styles[`btn_${kind}`],
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? <Icon name={icon} size={18} color={kind === 'tonal' || kind === 'outline' ? C.ink : kind === 'pos' ? C.pos : kind === 'neg' ? C.neg : '#fff'} /> : null}
      <Text style={[styles.btnText, (kind === 'tonal' || kind === 'outline') && { color: C.ink }, kind === 'pos' && { color: C.pos }, kind === 'neg' && { color: C.neg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, hint, value, onFocus, onBlur, ...props }: { label: string; hint?: string } & TextInputProps) {
  const [focus, setFocus] = useState(false);
  const raised = focus || String(value ?? '').length > 0;
  return (
    <View style={styles.field}>
      <TextInput
        placeholder=" "
        placeholderTextColor="transparent"
        value={value}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[styles.input, focus && styles.inputOn]}
        {...props}
      />
      <Text style={[styles.floatLabel, raised && styles.floatUp, focus && raised && { color: C.brand }]}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FlowBar({ backLabel = 'Back', onBack, hideBack = false, children }: { backLabel?: string; onBack: () => void; hideBack?: boolean; children: ReactNode }) {
  const { openPrahari } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {hideBack ? null : (
        <Pressable onPress={onBack} style={styles.flowBack}>
          <Text style={styles.flowBackText}>{backLabel}</Text>
        </Pressable>
      )}
      <View style={{ flex: 1 }}>{children}</View>
      <Pressable style={styles.navItem} onPress={() => openPrahari()}>
        <View style={styles.orb}>
          <PrahariMark size={30} />
        </View>
        <Text style={[styles.navLabel, { color: C.ink, fontWeight: '700' }]}>Prahari</Text>
      </Pressable>
    </View>
  );
}

export function PrahariFloat() {
  const { openPrahari } = useApp();
  return (
    <Pressable style={styles.float} onPress={() => openPrahari()}>
      <View style={styles.floatOrb}>
        <PrahariMark size={40} />
      </View>
      <Text style={styles.floatLbl}>Prahari</Text>
    </Pressable>
  );
}

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { openPrahari, session } = useApp();
  const c = L(session.lang);
  const insets = useSafeAreaInsets();
  const logs = path === '/logs' || path === '/insights' || path === '/verify';
  const items = logs
    ? [
        { href: '/home' as const, icon: 'home', label: c.home },
        { href: '/logs' as const, icon: 'logs', label: c.records },
        { href: '/insights' as const, icon: 'chart', label: c.insights },
        { href: '/verify' as const, icon: 'shield', label: c.verify },
      ]
    : [
        { href: '/home' as const, icon: 'home', label: c.home },
        { href: '/scan' as const, icon: 'scan', label: c.newTest },
        { href: '/logs' as const, icon: 'logs', label: c.audit },
      ];
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10), height: 80 + Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const on = path === item.href;
        return (
          <Pressable key={item.label} style={styles.navItem} onPress={() => router.push(item.href)}>
            <View style={[styles.ind, on && { backgroundColor: C.brandSoft }]}>
              <Icon name={item.icon} size={22} color={on ? C.onBrand : C.ink2} />
            </View>
            <Text style={[styles.navLabel, on && { color: C.ink, fontWeight: '700' }]}>{item.label}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.navItem} onPress={() => openPrahari()}>
        <View style={styles.orb}>
          <PrahariMark size={30} />
        </View>
        <Text style={[styles.navLabel, { color: C.ink, fontWeight: '700' }]}>Prahari</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 480, position: 'relative' },
  btn: {
    minHeight: 48,
    borderRadius: R.pill,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderCurve: 'continuous',
  },
  btn_dark: { backgroundColor: C.ink },
  btn_brand: { backgroundColor: C.brand },
  btn_tonal: { backgroundColor: C.surface2 },
  btn_outline: { borderWidth: 1, borderColor: C.outline, backgroundColor: 'transparent' },
  btn_pos: { backgroundColor: C.posSoft },
  btn_neg: { backgroundColor: C.negSoft },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  field: { marginTop: 16, position: 'relative' },
  input: {
    borderWidth: 1,
    borderColor: C.outline,
    borderRadius: R.input,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.bg,
  },
  inputOn: { borderWidth: 2, borderColor: C.brand },
  floatLabel: {
    position: 'absolute',
    left: 12,
    top: 18,
    paddingHorizontal: 4,
    backgroundColor: C.bg,
    color: C.muted,
    fontSize: 16,
  },
  floatUp: { top: -8, fontSize: 12, color: C.ink2 },
  hint: { fontSize: 12, color: C.muted, marginTop: 4, marginHorizontal: 16 },
  flow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 80,
    paddingTop: 8,
    paddingLeft: 16,
    paddingRight: 4,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.bg,
  },
  flowBack: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowBackText: { fontWeight: '600', color: C.ink, fontSize: 15 },
  float: { position: 'absolute', right: 14, bottom: 18, alignItems: 'center', zIndex: 5 },
  floatOrb: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,.12)',
  },
  floatLbl: { fontSize: 12, fontWeight: '700', color: C.ink, backgroundColor: C.bg, borderRadius: 6, paddingHorizontal: 6, marginTop: 2 },
  nav: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingTop: 6,
  },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  ind: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, color: C.ink2, fontWeight: '500' },
});
