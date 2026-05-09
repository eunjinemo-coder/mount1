import { getSession } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

export const metadata = {
  title: '마운트파트너스',
};

export default async function HomePage(): Promise<ReactElement> {
  const session = await getSession();
  if (session?.userType === 'technician') {
    redirect('/today');
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>마운트파트너스</h1>
      <p>무타공 TV 벽걸이 시공 — 협력기사 전용 앱.</p>
      <p>
        로그인은 <a href="/login">여기</a>에서.
      </p>
    </main>
  );
}
