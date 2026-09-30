import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

import paths from '../../assets/brand/icons.json';
import { C } from '@/constants/brand';

const ICONS = paths as Record<string, string>;

/** 24px stroke icons from narcolens/brand/icons (design/brand.html). */
export function Icon({
  name,
  size = 22,
  color = C.ink,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const d = ICONS[name] ?? ICONS.spark;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Shield, reagent drop, and lens ring from narcolens/brand/svg/mark.svg. */
export function Mark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  const shield = light ? '#FFFFFF' : '#1B1C1F';
  const ring = light ? '#1B1C1F' : '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 5C24 8.5 16 11 9.5 12V29C9.5 43.5 18.5 54.5 32 59.5C45.5 54.5 54.5 43.5 54.5 29V12C48 11 40 8.5 32 5Z" fill={shield} />
      <Path d="M32 17C32 17 43 28.5 43 36.5A11 11 0 0 1 21 36.5C21 28.5 32 17 32 17Z" fill="#E8590C" />
      <Path d="M40.89 23.8A15.5 15.5 0 1 1 23.11 23.8" fill="none" stroke={ring} strokeWidth={2.6} strokeLinecap="round" />
      <Ellipse cx={27.6} cy={34.2} rx={2.1} ry={3.5} fill="#FFFFFF" opacity={0.9} transform="rotate(-25 27.6 34.2)" />
    </Svg>
  );
}

/**
 * Prahari, the field owl from narcolens/brand/svg/prahari.svg.
 * Idle blinks, listening opens the pupils, speaking pulses.
 */
export function PrahariMark({ size = 40, mood = 'idle' }: { size?: number; mood?: 'idle' | 'listen' | 'speak' }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [blink, setBlink] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mood !== 'idle') {
      setBlink(false);
      return;
    }
    const tick = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 3400);
    return () => clearInterval(tick);
  }, [mood]);

  useEffect(() => {
    if (mood !== 'speak') {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mood, scale]);

  const pupil = mood === 'listen' ? 7.2 : blink ? 1 : 5.6;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF8A3D" />
            <Stop offset="1" stopColor="#C94A05" />
          </LinearGradient>
        </Defs>
        <Path d="M13 20L20 9.5C24.5 13 28.2 14.2 32 14.2S39.5 13 44 9.5L51 20C54.8 25 56.5 30.4 56.5 36.5C56.5 50.5 45.6 58.5 32 58.5S7.5 50.5 7.5 36.5C7.5 30.4 9.2 25 13 20Z" fill={`url(#${gid})`} />
        <Path d="M21.5 49.5C24.5 52 28 53.2 32 53.2S39.5 52 42.5 49.5" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={23} cy={34} r={11} fill="#FFF1E6" />
        <Circle cx={41} cy={34} r={11} fill="#FFF1E6" />
        <Circle cx={23} cy={34.5} r={pupil} fill="#1B1C1F" />
        <Circle cx={41} cy={34.5} r={pupil} fill="#1B1C1F" />
        {blink ? null : (
          <>
            <Circle cx={25} cy={32.4} r={1.8} fill="#fff" />
            <Circle cx={43} cy={32.4} r={1.8} fill="#fff" />
          </>
        )}
        <Path d="M29.4 42.2H34.6L32 47.2Z" fill="#1B1C1F" />
      </Svg>
    </Animated.View>
  );
}
