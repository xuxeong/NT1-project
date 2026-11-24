import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/theme';

/** 아직 서버 API가 없는 탭(메시지·계정)에 보여 주는 임시 화면 */
export function ComingSoonScreen({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>
        <Text style={styles.text}>준비 중인 기능이에요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center', paddingVertical: 14 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { ...typography.body15, color: colors.textTertiary },
});
