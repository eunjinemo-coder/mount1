/**
 * 벽걸이프로 P1 — 구글시트 → 앱 동기화 Apps Script (설치형 onEdit 트리거)
 * =====================================================================
 * 은진님 시트에서 편집하면 이 스크립트가 서명된 페이로드를 앱 웹훅으로 POST 합니다.
 * 시트 양식은 절대 바꾸지 않습니다. 숨김열 하나(_sync_id)만 사용합니다.
 *
 * ── 설치 절차 (1회) ────────────────────────────────────────────────────────
 *  1. 시공 시트 열기 → 상단 메뉴 [확장 프로그램] → [Apps Script]
 *  2. 이 파일 전체를 복사해 Code.gs 에 붙여넣기
 *  3. 아래 CONFIG 3개 값을 앱 관리자(설정 › 구글시트 연동)에서 받아 채우기
 *       · WEBHOOK_URL   : https://admin.mountpartners.cloud/api/sheets-webhook
 *       · WEBHOOK_SECRET: 앱에서 발급한 공유 시크릿(SHEETS_WEBHOOK_SECRET 와 동일해야 함)
 *       · SYNC_ID_COL   : _sync_id 를 저장할 숨김열 문자(기본 'AI')
 *  4. 저장(디스크 아이콘) 후 상단에서 함수 [installTrigger] 선택 → [실행]
 *     → 최초 실행 시 권한 승인 팝업 → [허용]. (설치형 onEdit 트리거 1개 생성)
 *
 *  ※ AI 열은 동기화용 숨김 UUID 열입니다 — 이 열은 건드리지 말고, 원하면 숨기세요.
 *    은진님 시트 실데이터는 A~AH 를 쓰므로, 그 너머 빈 열(AI)에 기록해 데이터 칸과 겹치지 않습니다.
 *  5. (권장) 동기화 열(전화 뒷자리·날짜 등)은 서식을 "일반" 또는 "서식 없는 텍스트"로.
 *     앱은 RAW 로 값을 쓰므로 시트가 "0512"→512(선행0 소실)나 날짜 자동변환을 하지 않게 하면
 *     되돌이(에코) 정합이 안정적입니다.
 *  6. 끝. 이제 시트를 편집하면 자동으로 앱에 반영됩니다.
 *
 * ── 동작 요약 ──────────────────────────────────────────────────────────────
 *  · 편집된 행의 _sync_id 가 비어 있으면 새 UUID 를 발급해 숨김열에 기록(행 식별).
 *  · 행 값 + _sync_id + 편집시각을 JSON 으로 만들어 HMAC-SHA256 서명 후 POST.
 *  · 앱이 응답으로 준 syncRowId(신규 발급분)를 숨김열에 확정 기록.
 *  · 앱이 준 상태힌트(warn/conflict/archived)를 상태열(옵션)에 표기.
 *  · 앱→시트 쓰기가 되돌아온 편집은 앱이 content_hash 로 걸러 no-op(에코 루프 방지).
 */

// ── CONFIG (앱 관리자에서 값 받아 채우기) ──────────────────────────────────
var CONFIG = {
  WEBHOOK_URL: 'https://admin.mountpartners.cloud/api/sheets-webhook',
  WEBHOOK_SECRET: 'PASTE_SHEETS_WEBHOOK_SECRET_HERE',
  SYNC_ID_COL: 'AI',       // _sync_id 숨김열 (은진님 데이터 A~AH 너머 빈 열 — 건드리지 말 것)
  STATUS_COL: '',          // 상태표기 열(선택 · 비우면 표기 안 함)
  HEADER_ROWS: 1,          // 헤더 행 수(데이터는 그 다음 행부터)
};

/** 설치형 onEdit 트리거 설치 (1회 실행). */
function installTrigger() {
  // 중복 설치 방지 — 기존 onEditSync 트리거 제거 후 재설치
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditSync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditSync')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  SpreadsheetApp.getActive().toast('동기화 트리거 설치 완료', '벽걸이프로', 5);
}

/** 열 문자 → 1-base 열 인덱스 (A→1). */
function colToIndex_(letter) {
  var idx = 0;
  var up = String(letter).toUpperCase();
  for (var i = 0; i < up.length; i++) {
    idx = idx * 26 + (up.charCodeAt(i) - 64);
  }
  return idx;
}

/** UUID v4. */
function uuid_() {
  return Utilities.getUuid();
}

/** HMAC-SHA256 hex 서명 (앱의 verifySheetsSignature 와 동일 알고리즘). */
function sign_(secret, body) {
  var raw = Utilities.computeHmacSha256Signature(body, secret);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    if (b.length === 1) b = '0' + b;
    hex += b;
  }
  return hex;
}

/** 설치형 onEdit 핸들러. */
function onEditSync(e) {
  try {
    var sheet = e.range.getSheet();
    var row = e.range.getRow();
    if (row <= CONFIG.HEADER_ROWS) return; // 헤더 편집 무시

    var lastCol = sheet.getLastColumn();
    var values = sheet.getRange(row, 1, 1, lastCol).getValues()[0].map(function (v) {
      return v === null || v === undefined ? '' : String(v);
    });

    // _sync_id 확보(없으면 발급 후 시트에 기록)
    var syncCol = colToIndex_(CONFIG.SYNC_ID_COL);
    var syncId = String(values[syncCol - 1] || '');
    if (!syncId) {
      syncId = uuid_();
      sheet.getRange(row, syncCol).setValue(syncId);
      values[syncCol - 1] = syncId;
    }

    var payload = {
      spreadsheetId: e.source.getId(),
      sheetName: sheet.getName(),
      syncRowId: syncId,
      values: values,
      editedAt: new Date().toISOString(),
      deleted: false,
    };
    var body = JSON.stringify(payload);
    var signature = sign_(CONFIG.WEBHOOK_SECRET, body);

    var res = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: body,
      headers: { 'x-sheets-signature': signature },
      muteHttpExceptions: true,
    });

    var json = {};
    try { json = JSON.parse(res.getContentText()); } catch (_) {}

    // 앱이 확정한 syncRowId 기록(신규행 식별 고정)
    if (json && json.syncRowId && json.syncRowId !== syncId) {
      sheet.getRange(row, syncCol).setValue(json.syncRowId);
    }
    // 상태 힌트 표기(선택)
    if (CONFIG.STATUS_COL && json && json.writeBack) {
      var mark = json.writeBack === 'warn' ? '⚠ 형식 오류'
        : json.writeBack === 'conflict' ? '⚠ 충돌(시트 우선)'
        : json.writeBack === 'archived' ? '🗄 보관' : '✓';
      sheet.getRange(row, colToIndex_(CONFIG.STATUS_COL)).setValue(mark);
    }
  } catch (err) {
    // 트리거 실패는 조용히(폴링 백업이 유실을 복구). 필요 시 로그 확인.
    console.error('onEditSync 실패: ' + err);
  }
}
