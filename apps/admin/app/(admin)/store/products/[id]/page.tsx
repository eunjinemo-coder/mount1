import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, isValidUuid, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../../_layout/admin-shell';
import { safeSelect, storeClient } from '../../_lib/shared';
import { formatDateTime, formatWon, PRODUCT_STATUS_LABEL } from '../../_lib/labels';
import { ProductStatusToggle } from '../product-status-toggle';
import { VariantStockForm } from './variant-stock-form';

export const metadata = { title: '상품 상세' };

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  status: string;
  sort: number;
  created_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  base_price: number;
  stock_qty: number;
  active: boolean;
}

interface PriceTierRow {
  id: string;
  variant_id: string;
  min_qty: number;
  unit_price: number;
}

export default async function StoreProductDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  try {
    await requireRole({ adminRoles: ['super_admin', 'ops_admin', 'auditor'] });
  } catch (error) {
    if (error instanceof RedirectError) redirect('/login?redirect=/store/products');
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }

  const { id } = await props.params;
  if (!isValidUuid(id)) notFound();

  const session = await getSession();
  const canMutate =
    !!session?.adminRole && ['super_admin', 'ops_admin'].includes(session.adminRole);

  const client = storeClient(await getServerClient());

  const product = await safeSelect<ProductRow>(
    client
      .from('store_products')
      .select('id, slug, name, subtitle, status, sort, created_at, updated_at')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!product) notFound();

  const variantsData = await safeSelect<VariantRow[]>(
    client
      .from('store_variants')
      .select('id, product_id, name, sku, base_price, stock_qty, active')
      .eq('product_id', id)
      .order('name', { ascending: true }),
  );
  const variants = variantsData ?? [];

  const variantIds = variants.map((v) => v.id);
  const tiersData =
    variantIds.length > 0
      ? await safeSelect<PriceTierRow[]>(
          client
            .from('store_price_tiers')
            .select('id, variant_id, min_qty, unit_price')
            .in('variant_id', variantIds)
            .order('min_qty', { ascending: true }),
        )
      : [];
  const tiers = tiersData ?? [];
  const tiersByVariant = new Map<string, PriceTierRow[]>();
  for (const t of tiers) {
    const list = tiersByVariant.get(t.variant_id) ?? [];
    list.push(t);
    tiersByVariant.set(t.variant_id, list);
  }

  return (
    <AdminShell activeNav="storeProducts" title="상품 상세">
      <div className="mx-auto max-w-screen-xl space-y-6 px-6 py-6">
        <header className="flex items-baseline justify-between">
          <div>
            <Link className="text-muted-foreground text-sm hover:underline" href="/store/products">
              ← 상품 목록
            </Link>
            <h2 className="text-2xl font-bold">{product.name}</h2>
            <p className="text-muted-foreground font-mono text-sm">/p/{product.slug}</p>
          </div>
          {canMutate ? (
            <ProductStatusToggle productId={product.id} status={product.status} />
          ) : (
            <Badge variant={product.status === 'published' ? 'default' : 'secondary'}>
              {PRODUCT_STATUS_LABEL[product.status] ?? product.status}
            </Badge>
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Field label="부제목" value={product.subtitle ?? '-'} />
            <Field label="정렬 순서" value={String(product.sort)} />
            <Field label="등록일" value={formatDateTime(product.created_at)} />
            <Field label="수정일" value={formatDateTime(product.updated_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">상세 내용 편집</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              상세 섹션(히어로·스펙·갤러리·비교·FAQ)·이미지 편집 폼은 실제 상품 자료(사진·스펙·SKU)
              확보 후 구현 예정입니다(R5). 현재는 조회 · 상태 토글 · 재고 수정만 지원합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">변형 ({variants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">등록된 변형이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {variants.map((v) => (
                  <div className="rounded-md border p-3" key={v.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {v.name}{' '}
                          <span className="text-muted-foreground font-mono text-xs">{v.sku}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          기본 단가 {formatWon(v.base_price)} ·{' '}
                          <Badge variant={v.active ? 'default' : 'secondary'}>
                            {v.active ? '판매중' : '비활성'}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">재고</p>
                        {canMutate ? (
                          <VariantStockForm
                            currentStock={v.stock_qty}
                            productId={product.id}
                            variantId={v.id}
                          />
                        ) : (
                          <p className="font-medium tabular-nums">{v.stock_qty}</p>
                        )}
                      </div>
                    </div>
                    {(tiersByVariant.get(v.id) ?? []).length > 0 ? (
                      <table className="mt-3 w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-muted-foreground px-1 py-1 text-left font-semibold">
                              수량 구간
                            </th>
                            <th className="text-muted-foreground px-1 py-1 text-left font-semibold">
                              단가
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tiersByVariant.get(v.id) ?? []).map((t) => (
                            <tr key={t.id}>
                              <td className="px-1 py-1">{t.min_qty}개 이상</td>
                              <td className="px-1 py-1">{formatWon(t.unit_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">수량 구간 단가 없음</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
