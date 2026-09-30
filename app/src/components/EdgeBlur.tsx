import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';

const H = 52;

/** Softens content that has scrolled under the New test header. Hidden until the page moves. */
export function EdgeBlur({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  if (Platform.OS === 'web') {
    return <View pointerEvents="none" style={[webStyle, { opacity: amount }]} />;
  }
  return (
    <View pointerEvents="none" style={[styles.native, { opacity: amount }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <BlurView
          key={i}
          intensity={32 - i * 6}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H - i * 8 }}
        />
      ))}
      <View pointerEvents="none" style={styles.fade} />
    </View>
  );
}

const webStyle = {
  height: H,
  backgroundColor: 'transparent',
  backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.96), rgba(255,255,255,0))',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  maskImage: 'linear-gradient(to bottom, #000 0%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, transparent 100%)',
} as const;

const styles = StyleSheet.create({
  native: { height: H },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.94), rgba(255,255,255,0))',
  },
});
