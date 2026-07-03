import { getServerClient } from '@mount/db';
import { ForbiddenError, RedirectError, requireRole } from '@mount/lib';
import { Badge, Button, Card, CardContent } from '@mount/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import { safeSelect, storeClient } from '../_lib/shared';
import { PRODUCT_STATUS_LABEL } from '../_lib/labels';

export const metadata = { title: '스토어 상품 관리' };

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  status: string;
  sort: number;
}

interface VariantRow {
  id: string;
  product_id: string;
  stock_qty: number;
}

export default async function StoreProductsPage(): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'auditor'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/products');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const client = storeClient(await getServerClient());

  const productsData = await safeSelect<ProductRow[]>(
    client
      .from('store_products')
      .select('id, slug, name, subtitle, status, sort')
      .order('sort', { ascending: true }),
  );
  const products = productsData ?? [];

  const variantsData = await safeSelect<VariantRow[]>(
    client.from('store_variants').select('id, product_id, stock_qty'),
  );
  const variants = variantsData ?? [];

  const variantStatsByProduct = new Map<string, { count: number; stock: number }>();
  for (const v of variants) {
    const stat = variantStatsByProduct.get(v.product_id) ?? { count: 0, stock: 0 };
    stat.count += 1;
    stat.stock += v.stock_qty;
    variantStatsByProduct.set(v.product_id, stat);
  }

  return (
    <AdminShell activeNav="storeProducts" title="스토어 상품 관리">
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold">상품 관리</h2>
            <p className="text-muted-foreground text-sm">총 {products.length}개</p>
          </div>
          <Button disabled title="상품 등록 폼은 실자료 확보 후 구현 예정(R5)">
            <Plus className="mr-2 size-4" />
            상품 등록
          </Button>
        </header>

        <Card>
          <CardContent className="pt-6">
            {products.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 상품이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider">
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상품명</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">slug</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">변형 수</th>
                      <th className="text-muted-foreground px-2 py-3 text-left font-semibold">재고 합</th>
                      <th className="px-2 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const stat = variantStatsByProduct.get(p.id) ?? { count: 0, stock: 0 };
                      return (
                        <tr className="hover:bg-muted/40 border-b transition-colors last:border-0" key={p.id}>
                          <td className="px-2 py-3 font-medium">
                            {p.name}
                            {p.subtitle ? (
                              <p className="text-muted-foreground text-xs">{p.subtitle}</p>
                            ) : null}
                          </td>
                          <td className="text-muted-foreground px-2 py-3 font-mono text-xs">{p.slug}</td>
                          <td className="px-2 py-3">
                            <Badge variant={p.status === 'published' ? 'default' : 'secondary'}>
                              {PRODUCT_STATUS_LABEL[p.status] ?? p.status}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground px-2 py-3 tabular-nums">{stat.count}</td>
                          <td className="text-muted-foreground px-2 py-3 tabular-nums">{stat.stock}</td>
                          <td className="px-2 py-3 text-right">
                            <Link
                              className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                              href={`/store/products/${p.id}`}
                            >
                              상세 →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
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
