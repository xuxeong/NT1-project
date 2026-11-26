/** 고장 신고 유형 (팀 결정 11/27). 서버는 사유 글만 받으므로 '유형 · 상세 설명'으로 합쳐서 보냅니다. */
export const FAULT_TYPES = ['주행 이상', '센서 이상', '통신 이상', '차체 손상', '기타'] as const;

export type FaultType = (typeof FAULT_TYPES)[number];

/** 상세 설명 최대 글자 수 */
export const FAULT_DESCRIPTION_MAX = 200;

/** 서버로 보낼 사유. 예) '센서 이상 · 라이다 인식이 불안정해요', 설명이 없으면 '센서 이상' */
export function buildFaultReason(type: FaultType, description: string): string {
  const text = description.trim();
  return text ? `${type} · ${text}` : type;
}
