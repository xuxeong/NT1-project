import type { Manager } from '@/types/manager';

/**
 * [임시] 서버 DB에 미리 넣어 둔 가상 담당자 계정과 같은 값 (server/app/db/repository.py DEFAULT_MANAGER_ACCOUNTS).
 * 회원가입 없이 이 계정으로만 로그인합니다. 비밀번호는 모두 1234 (시험용).
 *
 * TODO(한정혁): 연동 시 POST /api/managers/login 응답으로 바꿔 주세요 (mocks/mockServer.ts의 mockLogin).
 */
export const MOCK_MANAGER_ACCOUNTS: (Manager & { password: string })[] = [
  {
    userId: 'manager1',
    password: '1234',
    name: '김관제 (1호차 담당)',
    phone: '010-1111-2222',
    role: 'manager',
    assignedAoi: 'C-Track 오창',
    assignedVehicleIds: ['X3S1181'],
  },
  {
    userId: 'manager2',
    password: '1234',
    name: '이순찰 (2호차 담당)',
    phone: '010-3333-4444',
    role: 'manager',
    assignedAoi: 'C-Track 오창',
    assignedVehicleIds: ['X3S1182'],
  },
  {
    userId: 'admin',
    password: '1234',
    name: '최총괄 (전체 관제)',
    phone: '010-9999-0000',
    role: 'admin',
    assignedAoi: 'C-Track 오창',
    assignedVehicleIds: ['X3S1181', 'X3S1182'],
  },
];
