import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RadioOffIcon, RadioOnIcon } from '@/components/icons';
import { StatusChip } from '@/components/StatusChip';
import { colors, typography } from '@/theme';
import type { Manager } from '@/types/manager';
import { PrimaryButton } from '@/ui';

type Props = {
  visible: boolean;
  /** 그 차량의 담당자 목록 */
  managers: Manager[];
  selectedId: string | null;
  /** 로그인한 계정 ('나' 표시) */
  myUserId: string | undefined;
  onClose: () => void;
  onConfirm: (userId: string) => void;
};

/** 알림 받을 담당자 선택 (Figma: 목적지 선택 · 담당자 선택) */
export function ManagerPickerSheet({ visible, managers, selectedId, myUserId, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  // 시트 안에서 누른 담당자. 아직 안 눌렀으면 지금 선택된 담당자(selectedId)를 보여 줍니다.
  const [touched, setTouched] = useState<string | null>(null);
  const picked = touched ?? selectedId;
  const close = () => {
    setTouched(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            알림 받을 담당자
          </Text>
          <Text style={styles.description}>차량이 출발하고 도착하면 이 사람에게 알림이 가요</Text>
        </View>

        <View accessibilityRole="radiogroup">
          {managers.map((m, i) => {
            const on = picked === m.userId;
            return (
              <View key={m.userId}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  onPress={() => setTouched(m.userId)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${m.name}, ${m.phone}${m.userId === myUserId ? ', 나' : ''}`}
                >
                  {on ? <RadioOnIcon width={20} height={20} /> : <RadioOffIcon width={20} height={20} />}
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={styles.phone}>{m.phone}</Text>
                  </View>
                  {m.userId === myUserId && <StatusChip label="나" tone="accent" />}
                </Pressable>
              </View>
            );
          })}
        </View>

        <PrimaryButton
          label="선택 완료"
          disabled={!picked}
          onPress={() => {
            if (!picked) return;
            setTouched(null);
            onConfirm(picked);
          }}
        />
      </View>
    </Modal>
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
    gap: 16,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  head: { gap: 4 },
  title: { ...typography.title17, color: colors.ink },
  description: { ...typography.body13, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.section14, color: colors.ink },
  phone: { ...typography.body13, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.hairline },
});
