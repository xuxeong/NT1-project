/**
 * 단어에 맞는 조사 '와/과'를 돌려줍니다. 예) X9 → '와', N3S1 → '과', 오창 → '과'
 * 한글은 받침으로, 숫자·영문은 읽는 소리(일·삼·엔 등)로 판단합니다.
 */
export function waGwa(word: string): '와' | '과' {
  return hasFinalConsonant(word) ? '과' : '와';
}

/** 단어에 맞는 조사 '이/가'. 예) X3S1181 → '이' (일), X3S1182 → '가' (이) */
export function iGa(word: string): '이' | '가' {
  return hasFinalConsonant(word) ? '이' : '가';
}

/** 숫자를 읽었을 때 받침이 있는 것: 0(영) 1(일) 3(삼) 6(육) 7(칠) 8(팔) */
const DIGITS_WITH_FINAL = new Set(['0', '1', '3', '6', '7', '8']);
/** 영문 알파벳을 읽었을 때 받침이 있는 것: L(엘) M(엠) N(엔) R(알) */
const LETTERS_WITH_FINAL = new Set(['L', 'M', 'N', 'R']);

function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0; // 한글 음절
  if (/[0-9]/.test(last)) return DIGITS_WITH_FINAL.has(last);
  if (/[a-zA-Z]/.test(last)) return LETTERS_WITH_FINAL.has(last.toUpperCase());
  return false;
}
