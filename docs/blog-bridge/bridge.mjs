#!/usr/bin/env node
/**
 * 시공 → 블로그 브릿지 (은진님 로컬 PC 실행)
 * ============================================================================
 * 하는 일:
 *   1. 시공 앱(admin)에서 "블로그 대기" 시공건을 당겨온다(완료 + 사진 있음 + 미전달)
 *   2. 사진을 로컬에 01_.jpg, 02_.jpg … 순서대로 내려받는다(생성기가 파일명 사전순으로 정렬)
 *   3. blog-automation 로컬 API 로 잡 생성(+선택적으로 초안 생성까지)
 *   4. 성공한 건을 앱에 "전달 완료"로 표시(중복 생성 방지)
 *
 * 왜 이 방향(pull)인가: 앱은 클라우드(Vercel), blog-automation 은 로컬(127.0.0.1:8000)이라
 * 클라우드가 로컬을 호출할 수 없다. 또 로컬 API 는 loopback 전용이라 이 스크립트가 같은 PC 에서
 * 돌아야 인증을 통과한다.
 *
 * 사용:
 *   node bridge.mjs                 # 대기건 가져와 잡 생성(초안 생성까지)
 *   node bridge.mjs --dry           # 가져오기만(파일 저장·잡 생성 안 함) — 내용 확인용
 *   node bridge.mjs --no-generate   # 잡만 만들고 초안 생성은 앱 화면에서 수동으로
 *   node bridge.mjs --limit 3
 *
 * 환경변수(.env 또는 셸):
 *   ADMIN_BASE       기본 https://mount-admin.vercel.app
 *   BLOG_BRIDGE_TOKEN  앱 Vercel 환경변수와 같은 값 (필수)
 *   BLOG_API         기본 http://127.0.0.1:8000
 *   BLOG_ADMIN_TOKEN blog-automation 이 ADMIN_API_TOKEN 을 쓰는 경우에만
 *   PHOTO_DIR        사진 저장 루트. 기본 ./bridge-photos
 * ============================================================================
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ADMIN_BASE = process.env.ADMIN_BASE ?? 'https://mount-admin.vercel.app';
const BRIDGE_TOKEN = process.env.BLOG_BRIDGE_TOKEN ?? '';
const BLOG_API = process.env.BLOG_API ?? 'http://127.0.0.1:8000';
const BLOG_ADMIN_TOKEN = process.env.BLOG_ADMIN_TOKEN ?? '';
const PHOTO_ROOT = process.env.PHOTO_DIR ?? path.resolve('bridge-photos');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const NO_GENERATE = args.includes('--no-generate');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.min(v, 20) : 5;
})();

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function extFromUrl(url) {
  const clean = url.split('?')[0] ?? '';
  const m = /\.(jpe?g|png|webp)$/i.exec(clean);
  return m ? m[0].toLowerCase().replace('.jpeg', '.jpg') : '.jpg';
}

async function fetchPending() {
  const res = await fetch(`${ADMIN_BASE}/api/blog/pending?limit=${LIMIT}`, {
    headers: { 'x-blog-token': BRIDGE_TOKEN },
  });
  if (res.status === 401) die('앱 인증 실패 — BLOG_BRIDGE_TOKEN 이 Vercel 값과 다릅니다.');
  if (res.status === 503) die('앱에 BLOG_BRIDGE_TOKEN 이 설정되지 않았습니다(기능 꺼짐).');
  if (!res.ok) die(`대기건 조회 실패: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.jobs ?? [];
}

async function downloadPhotos(job) {
  const dir = path.join(PHOTO_ROOT, job.jobId);
  await mkdir(dir, { recursive: true });
  const paths = [];
  for (let i = 0; i < job.photos.length; i += 1) {
    const p = job.photos[i];
    const res = await fetch(p.url);
    if (!res.ok) {
      console.warn(`  ⚠ 사진 ${i + 1} 내려받기 실패(HTTP ${res.status}) — 건너뜀`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // 생성기는 파일명 사전순으로 이미지 순서를 정한다 → 01_, 02_ … 로 고정
    const file = path.join(dir, `${String(i + 1).padStart(2, '0')}_photo${extFromUrl(p.url)}`);
    await writeFile(file, buf);
    paths.push(file);
  }
  return paths;
}

async function createBlogJob(job, imagePaths) {
  const headers = { 'content-type': 'application/json' };
  if (BLOG_ADMIN_TOKEN) headers['x-admin-token'] = BLOG_ADMIN_TOKEN;

  const res = await fetch(`${BLOG_API}/api/jobs/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content_type: job.content_type,
      title: job.title,
      site_note: job.site_note,
      images: imagePaths,
    }),
  });
  if (!res.ok) {
    throw new Error(`잡 생성 실패 HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const created = await res.json();
  const id = created.id ?? created.job_id ?? created.data?.id;
  if (!id) throw new Error(`잡 ID 를 못 받음: ${JSON.stringify(created).slice(0, 200)}`);

  if (!NO_GENERATE) {
    const gen = await fetch(`${BLOG_API}/api/jobs/${id}/generate`, { method: 'POST', headers });
    if (!gen.ok) {
      console.warn(`  ⚠ 초안 생성 실패(HTTP ${gen.status}) — 잡은 만들어졌으니 앱 화면에서 재시도 가능`);
    }
  }
  return id;
}

async function markExported(jobIds) {
  const res = await fetch(`${ADMIN_BASE}/api/blog/pending`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-blog-token': BRIDGE_TOKEN },
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) console.warn(`⚠ 전달표시 실패(HTTP ${res.status}) — 다음 실행에 중복될 수 있습니다.`);
}

async function main() {
  if (!BRIDGE_TOKEN) die('BLOG_BRIDGE_TOKEN 환경변수가 필요합니다.');

  console.log(`▶ 대기 시공건 조회 (${ADMIN_BASE}, 최대 ${LIMIT}건)`);
  const jobs = await fetchPending();
  if (jobs.length === 0) {
    console.log('· 블로그로 보낼 시공건이 없습니다(완료 + 사진 등록 + 미전달 조건).');
    return;
  }
  console.log(`· ${jobs.length}건 발견\n`);

  const done = [];
  for (const job of jobs) {
    console.log(`── ${job.title}`);
    console.log(`   사진 ${job.photos.length}장`);
    if (DRY) {
      console.log(`   [dry] site_note:\n${job.site_note.split('\n').map((l) => '     ' + l).join('\n')}\n`);
      continue;
    }
    try {
      const paths = await downloadPhotos(job);
      if (paths.length === 0) {
        console.warn('   ⚠ 사진을 하나도 못 받아 건너뜁니다.\n');
        continue;
      }
      const id = await createBlogJob(job, paths);
      console.log(`   ✔ 블로그 잡 생성 #${id}${NO_GENERATE ? '' : ' (초안 생성 요청됨)'}\n`);
      done.push(job.jobId);
    } catch (e) {
      console.error(`   ✖ ${e.message}\n`);
    }
  }

  if (done.length > 0) {
    await markExported(done);
    console.log(`▶ 완료: ${done.length}건 전달 표시`);
  }
  if (!DRY && !NO_GENERATE) {
    console.log(`▶ 초안 확인: ${BLOG_API} 화면에서 검수 후 발행하세요.`);
  }
}

main().catch((e) => die(e.message));
