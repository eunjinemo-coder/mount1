/**
 * 무통장입금 계좌 안내 — S4 주문완료 화면.
 *
 * TODO(R3.5/출시, 은진님 실계좌): 아래 값은 플레이스홀더다. 배포 전 실제 입금계좌로
 *   교체해야 한다. 계좌번호는 공개 안내 정보이므로 코드 상수로 관리하되,
 *   변경 빈도가 낮아 env 대신 상수로 둔다(변경 시 이 파일만 수정).
 */
export interface BankAccount {
  bankName: string;
  accountNo: string;
  holder: string;
}

export const BANK_ACCOUNT: BankAccount = {
  bankName: '○○은행', // TODO 실은행
  accountNo: '000-0000-0000-00', // TODO 실계좌번호
  holder: '벽걸이프로', // TODO 실예금주
};

/** 입금 기한 안내 문구용 — 72시간 (RPC expires_at = now()+72h 와 정합). */
export const PAYMENT_DEADLINE_HOURS = 72;
