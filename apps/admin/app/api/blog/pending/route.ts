import 'server-only';

/**
 * 블로그 자산화 브릿지 API — 로컬 blog-automation 이 "당겨가는(pull)" 진입점.
 *
 * 왜 pull 인가: admin 앱은 Vercel(클라우드), blog-automation 은 은진님 로컬 PC(127.0.0.1:8000)라
 * 클라우드→로컬 호출이 불가능하다. 또 blog-automation 의 /api/jobs/* 는 loopback 전용이라
 * 로컬 브릿지가 ①여기서 대기건을 받아 ②사진을 내려받고 ③로컬 API 로 잡을 만든다.
 *
 * 보안:
 *   · BLOG_BRIDGE_TOKEN 상수시간 비교(x-blog-token). 미설정 시 503(기능 꺼짐).
 *   · 응답 페이로드는 lib/blog/payload 가 PII 를 제거한 것만 담는다(성함·연락처·상세주소·단지명 없음).
 *   · 사진은 비공개 버킷의 단기 서명 URL.
 *   · 미들웨어 제외 대상(proxy.ts matcher) — 세션이 없는 머신 호출이므로.
 *
 * GET  /api/blog/pending           → 완료 + 사진 있음 + 미전달 시공건 목록(기본 5건)
 * POST /api/blog/pending  {jobIds} → 전달 완료 표시(blog_exported_at) · 중복 생성 방지
 */
import { timingSafeEqual } from 'node:crypto';
import { getAdminClient } from '@mount/db/admin';
import { log } from '@mount/lib';
import { buildBlogDraftPayload, toBlogJobRequest } from '@/lib/blog/payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PHOTO_BUCKET = 'photos-hot';
const SIGNED_TTL = 60 * 30; // 30분 — 브릿지가 즉시 내려받는 용도
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function tokenOk(provided: string | null): boolean {
  const expected = process.env.BLOG_BRIDGE_TOKEN;
  if (!expected || expected.length === 0) return false;
  if (!provided || provided.length === 0) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface JobRow {
  id: string;
  scheduled_install_date: string | null;
  address: string | null;
  install_type: string | null;
  install_content: string | null;
  special_notes: string | null;
}

interface PhotoRow {
  installation_job_id: string;
  storage_path: string;
  caption: string | null;
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.BLOG_BRIDGE_TOKEN) {
    return Response.json({ ok: false, error: 'bridge_disabled' }, { status: 503 });
  }
  if (!tokenOk(request.headers.get('x-blog-token'))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const client = getAdminClient();
    const cast = client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            is: (c: string, v: null) => {
              order: (c: string, o: { ascending: boolean }) => {
                limit: (n: number) => PromiseLike<{ data: JobRow[] | null }>;
              };
            };
          };
          in: (c: string, v: string[]) => {
            order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: PhotoRow[] | null }>;
          };
        };
      };
    };

    // 완료 + 미전달 시공건
    const { data: jobs } = await cast
      .from('installation_jobs')
      .select('id, scheduled_install_date, address, install_type, install_content, special_notes')
      .eq('status', 'completed')
      .is('blog_exported_at', null)
      .order('scheduled_install_date', { ascending: false })
      .limit(limit);

    const jobRows = jobs ?? [];
    if (jobRows.length === 0) return Response.json({ ok: true, jobs: [] });

    // 사진(있는 건만 대상)
    const { data: photos } = await cast
      .from('installation_photos')
      .select('installation_job_id, storage_path, caption')
      .in(
        'installation_job_id',
        jobRows.map((j) => j.id),
      )
      .order('created_at', { ascending: true });

    const byJob = new Map<string, PhotoRow[]>();
    for (const p of photos ?? []) {
      const arr = byJob.get(p.installation_job_id);
      if (arr) arr.push(p);
      else byJob.set(p.installation_job_id, [p]);
    }

    // 서명 URL 일괄 발급
    const allPaths = (photos ?? []).map((p) => p.storage_path);
    const urlByPath = new Map<string, string>();
    if (allPaths.length > 0) {
      const { data: signed } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(allPaths, SIGNED_TTL);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
      }
    }

    const out = jobRows
      .map((job) => {
        const jobPhotos = (byJob.get(job.id) ?? [])
          .map((p) => ({ url: urlByPath.get(p.storage_path) ?? '', caption: p.caption }))
          .filter((p) => p.url.length > 0);
        if (jobPhotos.length === 0) return null; // 사진 없는 건은 블로그 소재가 안 됨
        const payload = buildBlogDraftPayload({
          jobId: job.id,
          scheduledInstallDate: job.scheduled_install_date,
          address: job.address,
          installType: job.install_type,
          installContent: job.install_content,
          specialNotes: job.special_notes,
          photos: jobPhotos,
        });
        return { ...toBlogJobRequest(payload), jobId: payload.jobId, photos: payload.photos };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return Response.json({ ok: true, jobs: out });
  } catch (e) {
    log.error('blog bridge pending 실패', e);
    return Response.json({ ok: false, error: 'pending_failed' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOG_BRIDGE_TOKEN) {
    return Response.json({ ok: false, error: 'bridge_disabled' }, { status: 503 });
  }
  if (!tokenOk(request.headers.get('x-blog-token'))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let jobIds: string[];
  try {
    const body = (await request.json()) as { jobIds?: unknown };
    jobIds = Array.isArray(body.jobIds) ? body.jobIds.map((x) => String(x)) : [];
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  if (jobIds.length === 0) return Response.json({ ok: false, error: 'no_ids' }, { status: 400 });

  try {
    const client = getAdminClient();
    const { error } = await (
      client as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            in: (c: string, v: string[]) => PromiseLike<{ error: { message: string } | null }>;
          };
        };
      }
    )
      .from('installation_jobs')
      .update({ blog_exported_at: new Date().toISOString() })
      .in('id', jobIds);
    if (error) return Response.json({ ok: false, error: 'mark_failed' }, { status: 500 });

    log.info('blog bridge 전달 표시', { count: jobIds.length });
    return Response.json({ ok: true, marked: jobIds.length });
  } catch (e) {
    log.error('blog bridge mark 실패', e);
    return Response.json({ ok: false, error: 'mark_failed' }, { status: 500 });
  }
}
