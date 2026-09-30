import { forwardRef } from 'react';
import { Platform, ScrollView as RNScrollView, type ScrollViewProps } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('narcolens-hide-scrollbar')) {
  const style = document.createElement('style');
  style.id = 'narcolens-hide-scrollbar';
  style.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{width:0;height:0;display:none}';
  document.head.appendChild(style);
}

/** Scrolls, without a visible bar on web or Android. */
export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(function ScrollView(props, ref) {
  return <RNScrollView {...props} ref={ref} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} />;
});
