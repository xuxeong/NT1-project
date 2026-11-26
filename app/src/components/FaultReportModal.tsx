import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChipGrid, FilterChip } from '@/components/FilterChip';
import { BackIcon, WarningIcon } from '@/components/icons';
import { buildFaultReason, FAULT_DESCRIPTION_MAX, FAULT_TYPES, type FaultType } from '@/constants/fault';
import { colors, radius, typography } from '@/theme';
import type { Vehicle } from '@/types/vehicle';
import { DangerButton } from '@/ui';

type Props = {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  /** 신고를 보냅니다. 실패하면 예외를 던져 주세요 (화면에 오류 문구 표시) */
  onSubmit: (reason: string) => Promise<void>;
};

/**
 * 고장 신고 화면 (Figma: 고장 신고 화면 · 입력 전 / 입력 완료 / 신고 확인 창).
 * 차량 상세 위에 전체 화면으로 띄웁니다. 주행 중인 차량이면 신고 전에 한 번 더 확인합니다.
 */
export function FaultReportModal({ visible, vehicle, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<FaultType | null>(null);
  const [description, setDescription] = useState('');
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // 열 때마다 입력을 비우고 고장 시각을 지금으로 맞춥니다.
  useEffect(() => {
    if (!visible) return;
    setType(null);
    setDescription('');
    setOpenedAt(Date.now());
    setFailed(false);
  }, [visible]);

  const submit = async () => {
    if (!type) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setFailed(false);
    try {
      await onSubmit(buildFaultReason(type, description));
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onPressReport = () => {
    // 주행 중이면 차량이 바로 멈추므로 한 번 더 묻습니다.
    if (vehicle.missionStatus === 1) setConfirmOpen(true);
    else submit();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top }]}
        // 키보드가 올라오면 하단 버튼이 가려지지 않도록 화면을 줄입니다.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.backButton}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <BackIcon width={24} height={24} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            고장 신고
          </Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.vehicle}>
            <Text style={styles.vehicleId}>{vehicle.vin}</Text>
            <Text style={styles.vehicleArea}>{vehicle.parkName}</Text>
          </View>

          <View style={styles.notice}>
            <WarningIcon width={18} height={18} color={colors.danger} />
            <Text style={styles.noticeText}>신고하면 차량이 바로 멈추고, 고장을 해제하기 전까지 운행할 수 없어요</Text>
          </View>

          <Section label="고장 시각">
            <View style={[styles.box, styles.timeBox]}>
              <Text style={styles.timeText}>{formatDateTime(openedAt)}</Text>
            </View>
          </Section>

          <Section label="고장 유형" required>
            <ChipGrid>
              {FAULT_TYPES.map((t) => (
                <FilterChip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
              ))}
            </ChipGrid>
          </Section>

          <Section label="상세 설명" optional>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="어떤 문제가 있는지 적어 주세요"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              multiline
              maxLength={FAULT_DESCRIPTION_MAX}
              textAlignVertical="top"
              style={[styles.box, styles.textArea]}
              accessibilityLabel="상세 설명"
            />
          </Section>
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: 12 + insets.bottom }]}>
          {failed && <Text style={styles.error}>요청을 보내지 못했어요. 다시 시도해 주세요</Text>}
          <DangerButton label="고장 신고" disabled={!type} loading={submitting} onPress={onPressReport} />
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmOpen}
        title="고장을 신고할까요?"
        body={'주행 중인 차량이 바로 멈춰요.\n고장을 해제하기 전까지 운행할 수 없어요.'}
        confirmLabel="신고"
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </Modal>
  );
}

function Section({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        {label}
        {required && <Text style={{ color: colors.danger }}>*</Text>}
        {optional && <Text style={styles.optional}> (선택)</Text>}
      </Text>
      {children}
    </View>
  );
}

/** 2026-11-27 16:05 */
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title17, color: colors.ink },
  content: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16, gap: 24 },
  vehicle: { gap: 2 },
  vehicleId: { ...typography.value18, color: colors.ink },
  vehicleArea: { ...typography.body13, color: colors.textSecondary },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSubtle,
  },
  noticeText: { ...typography.body13, color: colors.danger, flex: 1 },
  section: { gap: 10 },
  sectionLabel: { ...typography.section14, color: colors.ink },
  optional: { ...typography.body13, color: colors.textTertiary },
  box: { borderRadius: 14, backgroundColor: colors.sheet },
  timeBox: { height: 52, paddingHorizontal: 16, justifyContent: 'center' },
  timeText: { ...typography.num13, color: colors.textSecondary },
  // Android에서 Noto Sans KR 위아래 여백 때문에 글자가 잘리지 않도록 lineHeight를 빼고 씁니다.
  textArea: {
    height: 120,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: typography.body15.fontFamily,
    fontSize: typography.body15.fontSize,
    color: colors.ink,
    includeFontPadding: false,
  },
  bottom: { paddingTop: 12, paddingHorizontal: 16, gap: 8 },
  error: { ...typography.body13, color: colors.danger, textAlign: 'center' },
});
