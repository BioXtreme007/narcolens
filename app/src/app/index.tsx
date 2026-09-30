import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { C } from '@/constants/brand';
import { useApp } from '@/lib/store';

export default function Index() {
  const { ready } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <Redirect href="/welcome" />;
}
