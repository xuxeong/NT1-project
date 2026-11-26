import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/**
 * 데이터를 불러오는 함수를 실행하고 로딩·오류 상태를 함께 돌려줍니다.
 * 예) const { data, loading, error, reload } = useAsync(() => fetchVehicles(), []);
 *
 * - loading: 불러오는 중 (화면에 회색 뼈대 표시)
 * - error: 실패 (ErrorState의 다시 시도 → reload)
 * - 늦게 도착한 이전 요청의 결과는 버립니다.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    run()
      .then((result) => {
        if (id === requestId.current) setData(result);
      })
      .catch((e: unknown) => {
        if (id === requestId.current) setError(e);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [run]);

  useEffect(() => {
    reload();
    return () => {
      // 화면을 떠난 뒤 도착한 결과는 무시합니다.
      requestId.current++;
    };
  }, [reload]);

  return { data, loading, error, reload };
}
