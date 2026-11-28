import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { FilterChip } from '@/components/FilterChip';
import { ChevronRightIcon, FlagLineIcon, RouteIcon, TabMessageIcon, WarningIcon } from '@/components/icons';
import { SkeletonBlock, SkeletonGroup } from '@/components/Skeleton';
import { useNotifications } from '@/state/notifications';
import { colors, radius, typography } from '@/theme';
import type { AppNotification } from '@/types/notification';
import {
  formatNotificationTime,
  notificationSection,
  notificationSenderText,
  notificationText,
} from '@/utils/notification';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'departed', label: '출발' },
  { key: 'arrived', label: '도착' },
  { key: 'faultReport', label: '차량 이상' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

/**
 * 메시지 탭 (Figma: 메시지 탭 · 알림 목록 / 알림 없음).
 * 내가 받은 알림을 보여 줍니다: 내가 알림 받을 담당자인 운행의 출발·도착, 담당 차량의 고장 신고.
 * 둘째 줄에는 보낸 사람(운행시킨 사람 / 신고한 사람)의 이름·연락처가 나옵니다.
 * 알림은 state/notifications.tsx가 10초마다 조회하고, 이 탭을 보면 모두 읽음으로 바뀝니다.
 */
export default function MessagesTab() {
  const insets = useSafeAreaInsets();
  const { items, error, refresh, markAllSeen } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>('all');

  // 탭을 보고 있는 동안 새로 온 알림도 바로 읽음으로 표시합니다.
  useFocusEffect(
    useCallback(() => {
      markAllSeen();
    }, [markAllSeen]),
  );

  const sections = useMemo(() => {
    const filtered = (items ?? []).filter((n) => filter === 'all' || n.type === filter);
    const groups: { title: string; data: AppNotification[] }[] = [];
    for (const n of filtered) {
      const title = notificationSection(n.createdAt);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(n);
      else groups.push({ title, data: [n] });
    }
    return groups;
  }, [items, filter]);

  const openVehicle = (vin: string) => router.push({ pathname: '/vehicle/[vin]', params: { vin } });

  let body: React.ReactNode;
  if (items === null && error) {
    body = <ErrorState onRetry={() => refresh()} style={styles.center} />;
  } else if (items === null) {
    body = <MessagesSkeleton />;
  } else if (sections.length === 0) {
    body = <EmptyState filtered={filter !== 'all'} />;
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.list}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.data.map((n, i) => (
                <Fragment key={n.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <NotificationRow notification={n} onPress={() => openVehicle(n.vehicleId)} />
                </Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title} accessibilityRole="header">
        메시지
      </Text>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            style={styles.chip}
          />
        ))}
      </View>
      {body}
    </View>
  );
}

/** 알림 한 줄 (Figma: Notification Row). 누르면 차량 상세로 이동 */
function NotificationRow({ notification: n, onPress }: { notification: AppNotification; onPress: () => void }) {
  const { title } = notificationText(n);
  const time = formatNotificationTime(n.createdAt);
  const sub = notificationSenderText(n);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${time}, ${sub}`}
      accessibilityHint="차량 상세로 이동해요"
    >
      <TypeIcon type={n.type} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={styles.rowTime}>{time}</Text>
      <ChevronRightIcon width={20} height={20} />
    </Pressable>
  );
}

/** 알림 유형 아이콘: 출발(파란 경로) · 도착(초록 깃발) · 고장 신고(빨간 경고) */
function TypeIcon({ type }: { type: AppNotification['type'] }) {
  const bg = { departed: colors.accentSubtle, arrived: colors.successSubtle, faultReport: colors.dangerSubtle }[type];
  return (
    <View style={[styles.rowIcon, { backgroundColor: bg }]}>
      {type === 'departed' && <RouteIcon width={20} height={20} />}
      {type === 'arrived' && <FlagLineIcon width={20} height={20} color={colors.success} />}
      {type === 'faultReport' && <WarningIcon width={20} height={20} color={colors.danger} />}
    </View>
  );
}

/** 알림 없음 (Figma: 메시지 탭 · 알림 없음) */
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <TabMessageIcon width={26} height={26} color={colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{filtered ? '이 유형의 알림이 없어요' : '아직 받은 알림이 없어요'}</Text>
      {!filtered && (
        <Text style={styles.emptyDescription}>
          맡은 운행이 출발·도착하거나{'\n'}담당 차량에 고장 신고가 접수되면 여기에 보여요
        </Text>
      )}
    </View>
  );
}

function MessagesSkeleton() {
  return (
    <SkeletonGroup style={styles.list}>
      <SkeletonBlock width={28} height={12} />
      <View style={[styles.card, styles.skeletonCard]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <SkeletonBlock width={40} height={40} radius={20} />
            <View style={styles.rowText}>
              <SkeletonBlock width={140} height={14} />
              <SkeletonBlock width={170} height={12} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.subtle },
  title: { ...typography.title17, color: colors.ink, textAlign: 'center', paddingVertical: 14 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  chip: { paddingHorizontal: 14 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 16 },
  section: { gap: 8 },
  sectionTitle: { ...typography.label12, color: colors.textTertiary },
  card: { backgroundColor: colors.sheet, borderRadius: radius.lg, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 68, backgroundColor: colors.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...typography.section14, color: colors.ink },
  rowSub: { ...typography.body13, color: colors.textSecondary },
  rowTime: { ...typography.label12, color: colors.textTertiary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, paddingBottom: 60 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { ...typography.section14, color: colors.ink },
  emptyDescription: { ...typography.body13, color: colors.textSecondary, textAlign: 'center' },
  skeletonCard: { padding: 16, gap: 20 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
