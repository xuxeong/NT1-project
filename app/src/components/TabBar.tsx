import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import { TabAccountIcon, TabMessageIcon, TabVehicleIcon } from '@/components/icons';
import { colors, typography } from '@/theme';

/** 탭 이름(src/app/(tabs)/ 파일 이름) → 표시 글자와 아이콘 */
const TABS: Record<string, { label: string; icon: FC<SvgProps> }> = {
  index: { label: '차량', icon: TabVehicleIcon },
  messages: { label: '메시지', icon: TabMessageIcon },
  account: { label: '계정', icon: TabAccountIcon },
};

/** 하단 탭 바 */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: 8 + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === index;
        const Icon = tab.icon;
        return (
          <Pressable
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            {/* Figma: 선택된 탭 아이콘은 파랑, 나머지는 ink */}
            <Icon width={24} height={24} color={active ? colors.accent : colors.ink} />
            <Text style={[styles.label, { color: active ? colors.accent : colors.textSecondary }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    backgroundColor: colors.sheet,
    boxShadow: '0px -2px 6px rgba(13, 18, 23, 0.06)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: typography.caption11,
});
