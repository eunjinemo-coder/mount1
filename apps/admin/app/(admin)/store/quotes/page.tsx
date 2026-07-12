import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent } from '@mount/ui';
import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { AdminShell } from '../../_layout/admin-shell';
import { safeSelect, storeClient } from '../_lib/shared';
import { formatDateTime, STORE_QUOTE_ROLES } from '../_lib/labels';
import { QuoteStatusSelect } from './quote-status-select';

export const metadata = { title: '스토어 견적요청함' };

interface QuoteRow {
  id: string;
  company: string;
  contact_name: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function StoreQuotesPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: [...STORE_QUOTE_ROLES] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/quotes');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = storeClient(await getServerClient());

  const quotesData = await safeSelect<QuoteRow[]>(
    client
      .from('store_quote_requests')
      .select('id, company, contact_name, phone, message, status, created_at')
      .order('created_at', { ascending: false }),
  );
  const quotes = quotesData ?? [];
  const newCount = quotes.filter((q) => q.status === 'new').length;

  return (
    <AdminShell activeNav="storeQuotes" title="견적요청함">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">대량 견적요청</h2>
            <p className="text-muted-foreground text-sm">총 {quotes.length}건</p>
          </div>
          {newCount > 0 ? <Badge>신규 {newCount}건</Badge> : null}
        </header>

        <Card>
          <CardContent className="pt-6">
            {quotes.length === 0 ? (
              <p className="text-muted-foreground text-sm">접수된 견적요청이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider">
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상호</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">담당자</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">연락처</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">문의 내용</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">접수일</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr className="hover:bg-muted/40 border-b transition-colors last:border-0" key={q.id}>
                        <td className="px-2 py-3 font-medium">
                          {q.company}
                          {q.status === 'new' ? (
                            <Badge className="ml-2" variant="default">
                              NEW
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">{q.contact_name}</td>
                        <td className="text-muted-foreground px-2 py-3 tabular-nums">{q.phone}</td>
                        <td className="max-w-xs px-2 py-3">
                          <p className="line-clamp-2 text-xs">{q.message}</p>
                        </td>
                        <td className="text-muted-foreground px-2 py-3 tabular-nums">
                          {formatDateTime(q.created_at)}
                        </td>
                        <td className="px-2 py-3">
                          <QuoteStatusSelect quoteId={q.id} status={q.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
