import { redirect } from 'next/navigation';

export default function ProfilePage(): never {
  // 프로필 화면은 settings 와 통합 — settings 로 redirect
  redirect('/settings');
}
