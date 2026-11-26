import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { WarningIcon } from '@/components/icons';
import { colors, typography } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  /** 빨간 확인 버튼 문구. 예) '작업 취소', '신고' */
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 되돌리기 어려운 동작 전에 한 번 더 묻는 확인 창 (Figma: 작업 취소 확인 창) */
export function ConfirmDialog({ visible, title, body, confirmLabel, onClose, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <WarningIcon width={24} height={24} color={colors.danger} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.button, styles.close, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonLabel, { color: colors.ink }]}>닫기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, styles.confirm, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonLabel, { color: colors.onInk }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(14, 17, 22, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 311,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 20,
    alignItems: 'center',
    backgroundColor: colors.sheet,
    boxShadow: '0px 8px 24px rgba(13, 18, 23, 0.15)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSubtle,
  },
  texts: { gap: 8, alignItems: 'center' },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center' },
  body: { ...typography.body13, color: colors.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  button: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  close: { backgroundColor: colors.subtle },
  confirm: { backgroundColor: colors.danger },
  pressed: { opacity: 0.85 },
  buttonLabel: typography.button16,
});

/** 작업 취소 확인 창 */
export function CancelTaskDialog(props: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      {...props}
      title="작업을 취소할까요?"
      body={'주행 중인 차량을 먼저 멈춘 뒤 작업을 취소해요.\n취소한 작업은 되돌릴 수 없어요.'}
      confirmLabel="작업 취소"
    />
  );
}
