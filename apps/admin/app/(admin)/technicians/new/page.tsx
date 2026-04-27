import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { NewTechnicianForm } from './new-technician-form';

export const metadata = { title: '협력기사 발급' };

export default async function NewTechnicianPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin'] });
  } catch (error) {
    if (error instanceof RedirectError) {
      redirect('/login?redirect=/technicians/new');
    }
    if (error instanceof ForbiddenError) {
      redirect('/login?error=forbidden');
    }
    throw error;
  }

  return (
    <AdminShell activeNav="technicians" title="협력기사 발급">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        <header>
          <h2 className="text-2xl font-bold">협력기사 신규 발급</h2>
          <p className="text-muted-foreground text-sm">
            대표(super_admin) 권한 전용 — 등록 시 자동으로 로그인 계정이 생성됩니다.
          </p>
        </header>

        <NewTechnicianForm />
      </div>
    </AdminShell>
  );
}
