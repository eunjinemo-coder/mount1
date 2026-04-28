import { redirect } from 'next/navigation';

/**
 * Admin 앱 root — 인증 통과 시 /today 로 즉시 redirect.
 * proxy.ts 가 '/' 도 인증 요구하므로, 미인증 시 자동으로 /login 으로 떨어짐.
 */
export default function AdminRootPage(): never {
  redirect('/today');
}
