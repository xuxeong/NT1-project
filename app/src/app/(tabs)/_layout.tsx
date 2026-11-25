import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';

/** 하단 탭: 차량 / 메시지 / 계정 */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '차량' }} />
      <Tabs.Screen name="messages" options={{ title: '메시지' }} />
      <Tabs.Screen name="account" options={{ title: '계정' }} />
    </Tabs>
  );
}
