import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession, isValidUuid, log, RedirectError, requireRole } from '@mount/lib';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { AdminShell } from '../../_layout/admin-shell';
import type { InstallationFormInput } from '../actions';
import { InstallationForm } from '../installation-form';
import { InstallationPhotos, type InstallationPhotoView } from './installation-photos';
import { StatusQuickActions } from './status-quick-actions';

export const metadata = { title: '시공 상세' };

const WRITE_ROLES = ['super_admin', 'ops_admin'];
const PHOTO_BUCKET = 'photos-hot';
const SIGNED_URL_TTL = 60 * 60; // 1시간

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

interface JobRow {
  id: string;
  scheduled_install_date: string | null;
  received_date: string | null;
  move_date: string | null;
  visit_time: string | null;
  technician_name: string | null;
  customer_phone: string | null;
  customer_phone2: string | null;
  address: string | null;
  address_detail: string | null;
  customer_name: string | null;
  install_type: string | null;
  install_content: string | null;
  special_notes: string | null;
  status: string | null;
}

const SELECT =
  'id, scheduled_install_date, received_date, move_date, visit_time, technician_name, ' +
  'customer_phone, customer_phone2, address, address_detail, customer_name, install_type, ' +
  'install_content, special_notes, status';

/** date 컬럼이 timestamptz 로 넘어와도 <input type=date> 용 YYYY-MM-DD 로. */
function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function toInitial(row: JobRow): Partial<InstallationFormInput> {
  return {
    scheduled_install_date: dateInput(row.scheduled_install_date),
    received_date: dateInput(row.received_date),
    move_date: dateInput(row.move_date),
    visit_time: row.visit_time ?? '',
    technician_name: row.technician_name ?? '',
    customer_phone: row.customer_phone ?? '',
    customer_phone2: row.customer_phone2 ?? '',
    address: row.address ?? '',
    address_detail: row.address_detail ?? '',
    customer_name: row.customer_name ?? '',
    install_type: row.install_type ?? '',
    install_content: row.install_content ?? '',
    special_notes: row.special_notes ?? '',
    status: row.status ?? 'scheduled',
  };
}

interface PhotoRow {
  id: string;
  storage_path: string;
  caption: string | null;
}

/**
 * 시공 사진 로드 + 서명 URL 생성. photos-hot 는 비공개 버킷이라 표시용 URL 을 서버에서 발급한다.
 * installation_photos(0026) 미적용 환경에서도 페이지가 죽지 않게 실패 시 빈 배열로 격하한다.
 */
async function loadInstallationPhotos(
  client: Awaited<ReturnType<typeof getServerClient>>,
  jobId: string,
): Promise<InstallationPhotoView[]> {
  try {
    const { data } = await (
      client as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: PhotoRow[] | null }>;
            };
          };
        };
      }
    )
      .from('installation_photos')
      .select('id, storage_path, caption')
      .eq('installation_job_id', jobId)
      .order('created_at', { ascending: true });

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const paths = rows.map((r) => r.storage_path);
    const { data: signed } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
    return rows.map((r) => ({ id: r.id, caption: r.caption, url: urlByPath.get(r.storage_path) ?? null }));
  } catch (e) {
    // 0026 미적용(테이블 없음)이면 정상 격하. 그 외(RLS/스토리지/네트워크)는 진단 위해 로깅.
    log.warn('시공 사진 로드 실패 — 사진 섹션 비활성', {
      jobId,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export default async function InstallationDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await props.params;
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof RedirectError) redirect(`/login?redirect=/installations/${id}`);
    if (error instanceof ForbiddenError) redirect('/login?error=forbidden');
    throw error;
  }
  if (!isValidUuid(id)) notFound();

  const client = await getServerClient();
  const { data } = await (
    client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => PromiseLike<{ data: JobRow | null }>;
          };
        };
      };
    }
  )
    .from('installation_jobs')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  const session = await getSession();
  const canWrite = !!session && WRITE_ROLES.includes(session.adminRole ?? '');
  const photos = await loadInstallationPhotos(client, data.id);

  return (
    <AdminShell activeNav="installations" title="시공 상세">
      <div className="mx-auto max-w-screen-md space-y-6 px-4 py-4 md:px-6 md:py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{data.customer_name ?? '시공 상세'}</h2>
            <Badge variant="outline">{STATUS_LABEL[data.status ?? ''] ?? data.status ?? '-'}</Badge>
          </div>
          <Link className="text-muted-foreground text-sm hover:underline" href="/installations">
            ← 목록
          </Link>
        </header>

        {/* 현장 요약 — 기사가 첫눈에 봐야 하는 것: 언제/누구/연락처/어디/뭘 */}
        <JobSummary row={data} />

        {canWrite ? <StatusQuickActions id={data.id} status={data.status ?? 'scheduled'} /> : null}

        <InstallationPhotos jobId={data.id} photos={photos} canWrite={canWrite} />

        {/* 세부 수정은 접어둔다 — 현장 동선(요약→상태→사진)을 가리지 않게 */}
        {canWrite ? (
          <details className="group rounded-lg border">
            <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium select-none">
              시공 정보 수정
              <span aria-hidden className="transition-transform group-open:rotate-90">
                →
              </span>
            </summary>
            <div className="border-t p-4">
              <InstallationForm id={data.id} initial={toInitial(data)} />
            </div>
          </details>
        ) : (
          <ReadonlyView row={data} />
        )}
      </div>
    </AdminShell>
  );
}

/** 전화번호 원문 → tel: 링크(숫자만). 숫자 7자리 미만이면 링크 없이 텍스트. */
function telHref(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 ? `tel:${digits}` : null;
}

/** 현장 요약 카드 — 방문시간 크게, 연락처는 탭=전화. */
function JobSummary({ row }: { row: JobRow }): ReactElement {
  const phone = row.customer_phone;
  const phoneLink = phone ? telHref(phone) : null;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold tabular-nums">{row.visit_time ?? '시간 미정'}</p>
          <p className="text-muted-foreground text-sm tabular-nums">
            {row.scheduled_install_date?.slice(0, 10) ?? '날짜 미정'}
          </p>
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex gap-3">
            <dt className="text-muted-foreground w-14 shrink-0">성함</dt>
            <dd className="font-medium">{row.customer_name ?? '-'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-muted-foreground w-14 shrink-0">연락처</dt>
            <dd>
              {phone ? (
                phoneLink ? (
                  <a className="text-primary font-medium underline underline-offset-2" href={phoneLink}>
                    {phone}
                  </a>
                ) : (
                  phone
                )
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-muted-foreground w-14 shrink-0">주소</dt>
            <dd className="min-w-0 break-keep">
              {[row.address, row.address_detail].filter(Boolean).join(' ') || '-'}
            </dd>
          </div>
          {row.install_content ? (
            <div className="flex gap-3">
              <dt className="text-muted-foreground w-14 shrink-0">설치내용</dt>
              <dd className="min-w-0 whitespace-pre-wrap">{row.install_content}</dd>
            </div>
          ) : null}
          {row.special_notes ? (
            <div className="flex gap-3">
              <dt className="text-muted-foreground w-14 shrink-0">특이사항</dt>
              <dd className="text-destructive/90 min-w-0 whitespace-pre-wrap font-medium">
                {row.special_notes}
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function ReadonlyView({ row }: { row: JobRow }): ReactElement {
  const items: { label: string; value: string | null }[] = [
    { label: '시공일자', value: row.scheduled_install_date },
    { label: '접수일자', value: row.received_date },
    { label: '이사일자', value: row.move_date },
    { label: '방문시간', value: row.visit_time },
    { label: '담당자', value: row.technician_name },
    { label: '성함', value: row.customer_name },
    { label: '연락처', value: row.customer_phone },
    { label: '연락처2', value: row.customer_phone2 },
    { label: '주소', value: row.address },
    { label: '상세주소', value: row.address_detail },
    { label: '타입', value: row.install_type },
    { label: '설치내용', value: row.install_content },
    { label: '특이사항', value: row.special_notes },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">시공 정보 (읽기 전용)</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {items.map((it) => (
            <div className="flex gap-4 py-2" key={it.label}>
              <dt className="text-muted-foreground w-24 shrink-0">{it.label}</dt>
              <dd className="min-w-0">{it.value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
