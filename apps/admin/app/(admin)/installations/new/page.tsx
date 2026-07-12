import { ForbiddenError, getSession, RedirectError, requireRole } from '@mount/lib';
import { Card, CardContent } from '@mount/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { InstallationForm } from '../installation-form';

export const metadata = { title: '시공 등록' };

const WRITE_ROLES = ['super_admin', 'ops_admin'];

export default async function NewInstallationPage(): Promise<ReactElement> {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/installations/new');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const session = await getSession();
  const canWrite = !!session && WRITE_ROLES.includes(session.adminRole ?? '');

  return (
    <AdminShell activeNav="installations" title="시공 등록">
      <div className="mx-auto max-w-screen-md space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">시공 등록</h2>
          <Link className="text-muted-foreground text-sm hover:underline" href="/installations">
            ← 목록
          </Link>
        </header>
        {canWrite ? (
          <InstallationForm />
        ) : (
          <Card>
            <CardContent className="text-muted-foreground py-6 text-sm">
              시공 등록은 대표(super_admin) 또는 운영(ops_admin)만 할 수 있어요.
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
