import 'server-only';

/**
 * enqueueSheetSync — 시공건(installation_jobs) 쓰기 성공 후 앱→시트 동기화 큐잉.
 *
 * 호출측(server action)과 디커플: 엔티티 저장이 성공한 뒤 이 헬퍼를 부르면 활성 링크마다
 * sync_outbox 에 pending 을 넣는다(content_hash=현재 스냅샷). 실제 시트 반영은 크론 워커.
 *
 * best-effort: enqueue 실패가 주문 저장을 되돌리지 않는다(트랜잭션 밖). 실패는 관측만 —
 * 다음 수정 시 재큐잉되고, 운영은 sync_log/위젯으로 지연을 감지한다.
 *
 * ⚠️ 이 헬퍼는 service_role(getAdminClient) 또는 RLS 통과 클라이언트로 호출해야 한다
 *    (sync_outbox INSERT 는 admin RLS 상 워커/service_role 경로). server action 에서는
 *    getAdminClient() 로 감싸 호출할 것.
 */
import { after } from 'next/server';
import { getAdminClient } from '@mount/db/admin';
import { captureMessage, log } from '@mount/lib';
import { contentHash, mappedFieldsForHash, processOutboxBatch } from '@mount/lib/sheets';
import { createInstallationAdapter } from './entity-adapter';
import { makeOutboxDeps } from './deps';
import { createSheetSyncStore } from './store';

export async function enqueueSheetSync(entityId: string, entity = 'installation'): Promise<void> {
  try {
    const client = getAdminClient();
    const store = createSheetSyncStore(client);
    const links = await store.activeLinksForEntity(entity);
    if (links.length === 0) return; // 연결된 시트 없음

    // 현재 entity 는 installation(installation_jobs) 만 지원(0025 참조).
    const adapter = createInstallationAdapter(client);
    const record = await adapter.read(entityId);
    if (!record) return;

    // 링크마다 열매핑이 다를 수 있어 링크별로 매핑필드 해시(워커 재계산과 정합).
    for (const link of links) {
      const hash = contentHash(mappedFieldsForHash(record.fields, link.columnMap));
      await store.enqueueOutbox(link.id, entityId, hash);
    }
    log.info('sheet sync enqueued', { entityId, entity, links: links.length });

    // 즉시 flush — 크론(Hobby: 하루 1회)을 기다리지 않고 앱→시트를 바로 반영.
    // after(): 응답 후 실행(non-blocking). 서비스계정 미설정/시트오류 시 throw→catch(크론·다음 수정 시 재시도).
    after(async () => {
      try {
        await processOutboxBatch(makeOutboxDeps(client));
      } catch (e) {
        log.warn('즉시 flush 실패(다음 크론/수정 시 재시도)', {
          entityId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
  } catch (e) {
    log.warn('enqueueSheetSync best-effort 실패', {
      entityId,
      error: e instanceof Error ? e.message : String(e),
    });
    captureMessage('enqueueSheetSync 실패', 'warning', { entityId, entity });
  }
}
