import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, CloseIcon, EditIcon, PersonIcon } from '@/components/icons';
import type { StopKind } from '@/state/routeDraft';
import { colors, typography } from '@/theme';

const TAG: Record<StopKind, { label: string; color: string; placeholder: string }> = {
  start: { label: '출발', color: colors.success, placeholder: '출발지를 선택해 주세요' },
  stop: { label: '경유', color: colors.textTertiary, placeholder: '경유지를 선택해 주세요' },
  end: { label: '도착', color: colors.danger, placeholder: '도착지를 선택해 주세요' },
};

type Props = {
  kind: StopKind;
  /** 고른 지점 이름. 없으면 '~를 선택해 주세요'를 흐리게 보여 줍니다. */
  name: string | null;
  /** 담당자 줄 표시 여부 (출발지는 표시 안 함) */
  showContact: boolean;
  contact: string | null;
  removable: boolean;
  /** false면 누를 수 없고 화살표(>)도 숨깁니다. 예) 출발지는 현재 위치로 고정 */
  selectable?: boolean;
  onPress: () => void;
  onContactPress: () => void;
  onRemove: () => void;
};

/** 경로 설정의 지점 한 줄 */
export function StopRow({
  kind,
  name,
  showContact,
  contact,
  removable,
  selectable = true,
  onPress,
  onContactPress,
  onRemove,
}: Props) {
  const tag = TAG[kind];
  return (
    <View style={styles.row}>
      <View style={styles.tagWrap}>
        <View style={[styles.tag, { backgroundColor: tag.color }]}>
          <Text style={styles.tagLabel}>{tag.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          style={styles.nameRow}
          onPress={onPress}
          disabled={!selectable}
          accessibilityRole={selectable ? 'button' : 'text'}
          accessibilityLabel={`${tag.label}: ${name ?? tag.placeholder}`}
        >
          <Text style={[styles.name, !name && styles.placeholder]} numberOfLines={1}>
            {name ?? tag.placeholder}
          </Text>
          {selectable && <ChevronRightIcon width={16} height={16} />}
        </Pressable>
        {showContact && (
          <Pressable style={styles.contactRow} onPress={onContactPress} accessibilityRole="button" hitSlop={4}>
            <PersonIcon width={16} height={16} />
            <Text style={styles.contact}>{contact ?? '담당자를 추가해 주세요'}</Text>
            <EditIcon width={14} height={14} />
          </Pressable>
        )}
      </View>

      {/* 삭제 자리는 X가 없어도 폭을 유지해 카드 폭을 맞춥니다 */}
      <View style={styles.removeSlot}>
        {removable && (
          <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${tag.label} 지점 삭제`}>
            <CloseIcon width={18} height={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tagWrap: { paddingTop: 14 },
  tag: { width: 44, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tagLabel: { ...typography.label12, color: colors.onInk },
  card: {
    flex: 1,
    gap: 6,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.subtle,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...typography.body15, color: colors.ink, flex: 1 },
  placeholder: { color: colors.textTertiary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  contact: { ...typography.body13, color: colors.textTertiary },
  removeSlot: { width: 18, paddingTop: 16 },
});
