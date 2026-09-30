import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PrahariSheet } from '@/components/Prahari';
import '@/components/Scroll';
import { AppProvider } from '@/lib/store';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#fff' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="home" />
          <Stack.Screen name="logs" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="record" />
          <Stack.Screen name="verify" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="scan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
        <PrahariSheet />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
