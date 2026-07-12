import 'server-only';

/**
 * Vercel Cron 엔드포인트 (5분 주기) — 스토어 발송/리마인드/만료 틱 + 시트 동기화 틱.
 *
 * 보안: Vercel Cron 은 CRON_SECRET env 설정 시 `Authorization: Bearer <CRON_SECRET>` 를
 *       자동 첨부한다. 시크릿 불일치·미설정 시 401. 상수시간 비교.
 *
 * 재실행 안전: storeCronTick·sheetsCronTick 모두 dedupe/상태전이/원자적 claim 기반 멱등(중복 0).
 *   스케줄: apps/admin/vercel.json 의 crons 에 { path:'/api/cron', schedule:'*\/5 * * * *' } 등록(M5).
 *   시트 outbox 지연을 5분 이내로 유지. PRD "3초 즉시성"은 즉시 트리거 워커(후속 과제)로 별도 처리.
 */
import { timingSafeEqual } from 'node:crypto';
import { getAdminClient } from '@mount/db/admin';
import { captureMessage, log } from '@mount/lib';
import { storeCronTick } from '@/lib/store/cron';
import { makeCronDeps } from '@/lib/store/notify-adapter';
import { sheetsCronTick } from '@/lib/sheets/cron';

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

    // 시트 양방향 동기화 틱(앱→시트 outbox 워커 + 시트→앱 폴링 백업) — 독립 실패 격리
    const sheets = await sheetsCronTick(serviceClient);
    if (sheets.errors.length > 0) {
      captureMessage('sheets sync 부분 실패', 'warning', { errors: sheets.errors });
    }
    log.info('sheets sync tick', {
      outbox: sheets.outbox,
      polledLinks: sheets.polledLinks,
      errorCount: sheets.errors.length,
    });

    return Response.json({ ok: true, ...result, sheets });
  } catch (e) {
    log.error('store cron tick 실패', e);
    return Response.json({ ok: false, error: 'cron_failed' }, { status: 500 });
  }
}
