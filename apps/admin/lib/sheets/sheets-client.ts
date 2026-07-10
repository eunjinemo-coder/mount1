import 'server-only';

/**
 * Google Sheets API 클라이언트 — SheetsApi(@mount/lib/sheets) 구현.
 *
 * 인터페이스 뒤에 두어 테스트/개발은 createMockSheetsApi 로 대체(실 API 미호출).
 * 실 구현(createGoogleSheetsApi)은 서비스계정 JWT → OAuth2 토큰 → Sheets v4 REST:
 *   1) sync_id 숨김열을 읽어 syncRowId 가 있는 행번호를 찾는다(행순서 비의존 — §2.2).
 *   2) 있으면 그 행의 매핑 셀만 update, 없으면 새 행 append.
 * 새 npm 의존 없이 node:crypto 로 RS256 JWT 서명.
 *
 * ⚠️ 부분구현(TODO): 배치 업데이트 최적화·지수백오프 재시도·rate limit 은 워커(outbox)
 *   레벨의 markFailed→다음틱 재시도로 대체. 대량 초기 백필은 별도 배치 작업으로.
 */
import { createSign } from 'node:crypto';
import { columnLetterToIndex } from '@mount/lib/sheets';
import type { SheetsApi, SheetLink } from '@mount/lib/sheets';
import type { GoogleServiceAccount } from './config';
import { computeInsertOffset } from './visit-time';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 서비스계정 JWT → 액세스 토큰(1시간). */
async function getAccessToken(sa: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(sa.privateKey));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`sheets_token_failed:${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('sheets_token_missing');
  return json.access_token;
}

/** 열 인덱스(0-base) → A1 열문자. */
function indexToColumn(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** sync_id 열을 읽어 syncRowId 가 있는 1-base 행번호를 찾는다(없으면 null). */
async function findRowNumber(
  token: string,
  link: SheetLink,
  syncRowId: string,
): Promise<number | null> {
  const range = encodeURIComponent(`${link.sheetName}!${link.syncIdColumn}${link.headerRow + 1}:${link.syncIdColumn}`);
  const res = await fetch(`${SHEETS_BASE}/${link.spreadsheetId}/values/${range}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`sheets_read_failed:${res.status}`);
  const json = (await res.json()) as { values?: string[][] };
  const values = json.values ?? [];
  for (let i = 0; i < values.length; i += 1) {
    if ((values[i]?.[0] ?? '') === syncRowId) {
      return link.headerRow + 1 + i; // 데이터 시작행부터 오프셋
    }
  }
  return null;
}

/** sheetName → sheetId(gid) 해석 + 캐시(insertDimension 은 gid 필요). */
const sheetIdCache = new Map<string, number>();
async function getSheetId(token: string, spreadsheetId: string, sheetName: string): Promise<number> {
  const key = `${spreadsheetId}::${sheetName}`;
  const cached = sheetIdCache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`sheets_meta_failed:${res.status}`);
  const json = (await res.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const found = (json.sheets ?? []).find((s) => s.properties?.title === sheetName);
  const gid = found?.properties?.sheetId;
  if (gid === undefined) throw new Error('sheets_gid_not_found');
  sheetIdCache.set(key, gid);
  return gid;
}

export function createGoogleSheetsApi(sa: GoogleServiceAccount): SheetsApi {
  return {
    async upsertRow({ link, syncRowId, cells }) {
      const token = await getAccessToken(sa);
      const rowNumber = await findRowNumber(token, link, syncRowId);

      if (rowNumber !== null) {
        // update — 매핑 셀만 개별 range 로(batchUpdate values)
        const data = Object.entries(cells).map(([col, value]) => ({
          range: `${link.sheetName}!${col}${rowNumber}`,
          values: [[value]],
        }));
        const res = await fetch(
          `${SHEETS_BASE}/${link.spreadsheetId}/values:batchUpdate`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            // C3: RAW — USER_ENTERED 는 phone_tail4 "0512"→512(선행0 소실)·날짜 재해석으로 시트/에코 손상.
            body: JSON.stringify({ valueInputOption: 'RAW', data }),
          },
        );
        if (!res.ok) throw new Error(`sheets_update_failed:${res.status}`);
        return { upserted: true };
      }

      // 신규행 — 은진님 시트는 하나의 깔끔한 표(A=시공일자 asc, D=방문시간 asc).
      // 맨 아래 append 대신 정렬 위치에 행 삽입(은진님 요구). 오프셋은 computeInsertOffset
      // (순수·visit-time.test 로 검증). 날짜 파싱 실패 시 append 폴백.
      const DATE_COL = 'A'; // 시공일자
      const TIME_COL = 'D'; // 방문시간

      let maxIdx = 0;
      for (const col of Object.keys(cells)) maxIdx = Math.max(maxIdx, columnLetterToIndex(col));
      const rowArray: string[] = new Array(maxIdx + 1).fill('');
      for (const [col, value] of Object.entries(cells)) {
        const idx = columnLetterToIndex(col);
        if (idx >= 0) rowArray[idx] = value;
      }

      // 기존 데이터행의 A·D 를 읽어 삽입 오프셋 계산
      const adRange = encodeURIComponent(`${link.sheetName}!A${link.headerRow + 1}:D`);
      const adRes = await fetch(`${SHEETS_BASE}/${link.spreadsheetId}/values/${adRange}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!adRes.ok) throw new Error(`sheets_read_failed:${adRes.status}`);
      const adJson = (await adRes.json()) as { values?: string[][] };
      const existingAD = (adJson.values ?? []).map((r) => ({ date: r[0] ?? '', visit: r[3] ?? '' }));
      const offset = computeInsertOffset(existingAD, {
        date: cells[DATE_COL] ?? '',
        visit: cells[TIME_COL] ?? '',
      });

      if (offset === null) {
        // 날짜 파싱 실패 → 정렬 불가, 맨 아래 append 폴백
        const appendRange = encodeURIComponent(`${link.sheetName}!A${link.headerRow + 1}`);
        const res = await fetch(
          `${SHEETS_BASE}/${link.spreadsheetId}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ values: [rowArray] }),
          },
        );
        if (!res.ok) throw new Error(`sheets_append_failed:${res.status}`);
        return { upserted: true };
      }

      // 정렬 위치에 빈 행 삽입(insertDimension · 0-base grid index) 후 값 기록
      const sheetId = await getSheetId(token, link.spreadsheetId, link.sheetName);
      const insertIndex = link.headerRow + offset;
      const insRes = await fetch(`${SHEETS_BASE}/${link.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: insertIndex,
                  endIndex: insertIndex + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        }),
      });
      if (!insRes.ok) throw new Error(`sheets_insert_failed:${insRes.status}`);
      const writeRange = encodeURIComponent(`${link.sheetName}!A${insertIndex + 1}`);
      const wRes = await fetch(
        `${SHEETS_BASE}/${link.spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ values: [rowArray] }),
        },
      );
      if (!wRes.ok) throw new Error(`sheets_write_failed:${wRes.status}`);
      return { upserted: true };
    },
  };
}

/**
 * 인메모리 SheetsApi — 테스트/개발/드라이런용. syncRowId 로 upsert 를 시뮬레이션.
 * 실 API 를 절대 호출하지 않는다.
 */
export function createMockSheetsApi(): SheetsApi & {
  rows: Map<string, Record<string, string>>;
} {
  const rows = new Map<string, Record<string, string>>();
  return {
    rows,
    async upsertRow({ syncRowId, cells }) {
      rows.set(syncRowId, { ...(rows.get(syncRowId) ?? {}), ...cells });
      return { upserted: true };
    },
  };
}

export { indexToColumn };
