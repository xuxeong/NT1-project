import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, Close24Icon, FlagIcon, RouteIcon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectTask: () => void;
  onSelectTrial: () => void;
};

/** 주행 유형 선택 바텀 시트 */
export function DriveTypeSheet({ visible, onClose, onSelectTask, onSelectTrial }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.side} />
          <Text style={styles.title}>주행 유형 선택</Text>
          <Pressable style={styles.side} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
            <Close24Icon width={24} height={24} />
          </Pressable>
        </View>
        <View style={styles.options}>
          <Option
            icon={<RouteIcon width={24} height={24} />}
            title="작업 수행"
            description="출발지·경유지·도착지와 담당자를 정해 작업을 보내요"
            onPress={onSelectTask}
          />
          <Option
            icon={<FlagIcon width={24} height={24} />}
            title="시범 운행"
            description="작업 없이 차량을 시험 삼아 주행해요"
            onPress={onSelectTrial}
          />
        </View>
      </View>
    </Modal>
  );
}

function Option({ icon, title, description, onPress }: { icon: ReactNode; title: string; description: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${description}`}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.texts}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <ChevronRightIcon width={20} height={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 17, 22, 0.45)' },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  side: { width: 24, height: 24 },
  title: { ...typography.title17, color: colors.ink, flex: 1, textAlign: 'center' },
  options: { gap: 12, paddingBottom: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.subtle,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSubtle,
  },
  texts: { flex: 1, gap: 2 },
  optionTitle: { ...typography.section14, color: colors.ink },
  optionDesc: { ...typography.body13, color: colors.textSecondary },
});
