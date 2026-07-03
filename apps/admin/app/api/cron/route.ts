import 'server-only';

/**
 * Vercel Cron 엔드포인트 (15분 주기) — 스토어 발송/리마인드/만료 틱.
 *
 * 보안: Vercel Cron 은 CRON_SECRET env 설정 시 `Authorization: Bearer <CRON_SECRET>` 를
 *       자동 첨부한다. 시크릿 불일치·미설정 시 401. 상수시간 비교.
 *
 * 재실행 안전: storeCronTick 은 dedupe_key/상태전이 기반으로 멱등(중복발송 0).
 *   설정: vercel.json 의 crons 에 { path:'/api/cron', schedule:'*\/15 * * * *' } 등록 필요(R5).
 */
import { timingSafeEqual } from 'node:crypto';
import { getAdminClient } from '@mount/db/admin';
import { captureMessage, log } from '@mount/lib';
import { storeCronTick } from '@/lib/store/cron';
import { makeCronDeps } from '@/lib/store/notify-adapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 시크릿 미설정 = 거부(운영 필수)
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const serviceClient = getAdminClient();
    const result = await storeCronTick(makeCronDeps(serviceClient));

    if (result.errors.length > 0) {
      // 부분 실패 — 성공 단계는 반영, 실패 단계만 관측(다음 틱 재시도)
      captureMessage('store cron 부분 실패', 'warning', {
        errors: result.errors,
      });
    }
    log.info('store cron tick', {
      reminders: result.reminders,
      expired: result.expired,
      flush: result.flush,
      errorCount: result.errors.length,
    });

    return Response.json({ ok: true, ...result });
  } catch (e) {
    log.error('store cron tick 실패', e);
    return Response.json({ ok: false, error: 'cron_failed' }, { status: 500 });
  }
}
