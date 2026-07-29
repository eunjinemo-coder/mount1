import 'server-only';

/**
 * 시트→앱 웹훅 — Apps Script 설치형 onEdit 트리거가 서명된 편집 페이로드를 POST (§2.1).
 *
 * 보안: 본문 raw 문자열을 SHEETS_WEBHOOK_SECRET 로 HMAC-SHA256 서명(x-sheets-signature).
 *       상수시간 검증. 불일치/미설정 → 401(미반영).
 *
 * 정합성(순수 엔진 @mount/lib/sheets 위임):
 *   · 에코루프(incoming hash == last_synced_hash) → no-op
 *   · 멱등((link,sync_row,hash) dedup) → 중복 수신 1회 처리
 *   · 충돌(LWW, 동시수정 시 시트 우선) → 반영/보존 + conflict 로그
 *   · 비파괴 삭제(deleted → 보관) · 형식오류(⚠ writeBack)
 *
 * 응답: { ok, result, syncRowId, writeBack }. Apps Script 는 syncRowId(신규 발급 포함)를
 *   숨김열에 기록하고 writeBack('warn'|'conflict'|'archived')을 상태열에 표기한다.
 */
import { randomUUID } from 'node:crypto';
import { getAdminClient } from '@mount/db/admin';
import { captureMessage, log } from '@mount/lib';
import {
  contentHash,
  parseSheetRow,
  processInboundRow,
  verifySheetsSignature,
  SHEETS_SIGNATURE_HEADER,
  type InboundPayload,
} from '@mount/lib/sheets';
import { loadWebhookSecret } from '@/lib/sheets/config';
import { createSheetSyncStore } from '@/lib/sheets/store';
import { makeInboundDeps } from '@/lib/sheets/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface WebhookBody {
  spreadsheetId?: string;
  sheetName?: string;
  syncRowId?: string;
  values?: string[];
  deleted?: boolean;
  editedAt?: string;
  /** 행삭제 reconcile: 시트에 "현재 남아있는" sync_id 전체 목록(onChange REMOVE_ROW 시). */
  reconcileSyncIds?: string[];
}

export async function POST(request: Request): Promise<Response> {
  // 1) 서명 검증 (raw 본문 기준)
  const raw = await request.text();
  let secret: string;
  try {
    secret = loadWebhookSecret();
  } catch {
    // 시크릿 미설정 = 운영 미완 → 401(활성화 전)
    return Response.json({ ok: false, error: 'webhook_not_configured' }, { status: 401 });
  }
  const provided = request.headers.get(SHEETS_SIGNATURE_HEADER);
  if (!verifySheetsSignature(secret, raw, provided)) {
    return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  // 2) 파싱
  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  if (!body.spreadsheetId || !body.sheetName) {
    return Response.json({ ok: false, error: 'missing_sheet_id' }, { status: 400 });
  }

  try {
    const client = getAdminClient();
    const store = createSheetSyncStore(client);
    const link = await store.findLinkBySheet(body.spreadsheetId, body.sheetName);
    if (!link || !link.active) {
      // 연결 안 된 시트 → 조용히 무시(200, 재시도 유발 안 함)
      return Response.json({ ok: true, result: 'skipped_noop', reason: 'no_active_link' });
    }

    // 2.5) 행삭제 reconcile — onEdit 은 행 삭제를 감지 못 하므로(구글 제약), onChange 가
    //      "현재 시트에 남은 sync_id 전체"를 보낸다. 우리 행매핑 중 목록에 없는 것 = 삭제된 행
    //      → deleted 경로(보관 + 앱 상태 '취소'). 하드삭제는 하지 않는다(실수삭제 방어).
    if (Array.isArray(body.reconcileSyncIds)) {
      const present = new Set(body.reconcileSyncIds.map((s) => String(s)));
      const active = await store.listActiveRowMaps(link.id);
      const missing = active.filter((rm) => !present.has(rm.syncRowId));
      const deps = makeInboundDeps(client, link.entity);
      let archived = 0;
      for (const rm of missing) {
        const outcome = await processInboundRow(deps, {
          linkId: link.id,
          syncRowId: rm.syncRowId,
          fields: {},
          contentHash: '',
          sheetUpdatedAt: body.editedAt ?? null,
          deleted: true,
        });
        if (outcome.writeBack === 'archived') archived += 1;
      }
      log.info('sheets webhook reconcile', { link: link.id, checked: active.length, archived });
      return Response.json({ ok: true, result: 'reconciled', archived });
    }

    // 3) 행 파싱 + 형식검증 + 해시
    const values = Array.isArray(body.values) ? body.values.map((v) => String(v ?? '')) : [];
    const { fields, warnings } = parseSheetRow(values, link.columnMap);
    const hash = contentHash(fields);

    // 신규행(syncRowId 부재) → UUID 발급해 시트에 되돌려 기록하게 한다(§2.2)
    const syncRowId = body.syncRowId && body.syncRowId.length > 0 ? body.syncRowId : randomUUID();

    const payload: InboundPayload = {
      linkId: link.id,
      syncRowId,
      fields,
      contentHash: hash,
      sheetUpdatedAt: body.editedAt ?? null,
      deleted: body.deleted === true,
      hasFormatWarnings: warnings.length > 0,
    };

    const deps = makeInboundDeps(client, link.entity);
    const outcome = await processInboundRow(deps, payload);

    log.info('sheets webhook', {
      link: link.id,
      result: outcome.result,
      warnings: warnings.length,
    });

    return Response.json({
      ok: true,
      result: outcome.result,
      syncRowId, // Apps Script 가 숨김열에 기록(신규행 식별자 확정)
      writeBack: outcome.writeBack ?? null,
      warnings: warnings.map((w) => ({ field: w.field, rule: w.rule })),
    });
  } catch (e) {
    log.error('sheets webhook 실패', e);
    captureMessage('sheets webhook 실패', 'error', {
      sheet: body.sheetName,
    });
    return Response.json({ ok: false, error: 'webhook_failed' }, { status: 500 });
  }
}
