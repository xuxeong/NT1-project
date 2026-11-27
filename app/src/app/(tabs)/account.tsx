import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/state/auth';
import { colors, radius, typography } from '@/theme';

/**
 * 계정 탭: 로그인한 담당자 정보와 로그아웃.
 * TODO: 연락처 수정(PATCH /api/managers/{user_id}/contact)은 다음 작업에서 추가합니다.
 */
export default function AccountTab() {
  const insets = useSafeAreaInsets();
  const { manager, signOut } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!manager) return null;
  const isAdmin = manager.role === 'admin';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title} accessibilityRole="header">
        계정
      </Text>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileText}>
              <Text style={styles.name}>{manager.name}</Text>
              <Text style={styles.userId}>{manager.userId}</Text>
            </View>
            <StatusChip label={isAdmin ? '전체 관제' : '담당자'} tone={isAdmin ? 'accent' : 'success'} />
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow label="담당 구역" value={manager.assignedAoi} />
          <View style={styles.divider} />
          <InfoRow label="담당 차량" value={manager.assignedVehicleIds.join(', ') || '없음'} mono />
          <View style={styles.divider} />
          <InfoRow label="연락처" value={manager.phone} mono />
          <Text style={styles.hint}>담당 차량이 도착하거나 문제가 생기면 이 연락처로 알림이 가요.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}
          onPress={() => setConfirmOpen(true)}
          accessibilityRole="button"
        >
          <Text style={styles.logoutLabel}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={confirmOpen}
        title="로그아웃할까요?"
        body="다시 로그인해야 담당 차량을 볼 수 있어요."
        confirmLabel="로그아웃"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          signOut();
        }}
      />
    </View>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoValueNum]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center', paddingVertical: 14 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: colors.sheet, borderRadius: radius.xl, padding: 16, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.title17, color: colors.ink },
  userId: { ...typography.body13, color: colors.textSecondary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  infoLabel: { ...typography.body13, color: colors.textSecondary },
  infoValue: { ...typography.section14, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  infoValueNum: { fontFamily: typography.num13.fontFamily, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.hairline },
  hint: { ...typography.caption11, color: colors.textTertiary },
  logout: { alignItems: 'center', paddingVertical: 14 },
  logoutLabel: { ...typography.body15, color: colors.danger },
});
