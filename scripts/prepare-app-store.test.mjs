import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('.');
const source = readFileSync('scripts/prepare-app-store.mjs', 'utf8').replace("import { asc, sanitized } from './app-store-client.mjs';", 'const { asc, sanitized } = globalThis.__ascFixture;');
mkdirSync('artifacts/store-preparation-tests', { recursive: true });
let sequence = 0;
async function exercise({ prepare = false, state = 'PREPARE_FOR_SUBMISSION', buildVersion = '1.4.0', processing = 'VALID' } = {}) {
  const calls = [];
  const dir = mkdtempSync(join(root, 'artifacts/store-preparation-tests/case-'));
  mkdirSync(join(dir, 'appstore/localizations/en-US'), { recursive: true });
  writeFileSync(join(dir, 'appstore/localizations/en-US/release_notes.txt'), 'New release notes');
  writeFileSync(join(dir, 'appstore/review-notes-1.4.0.txt'), 'Current review instructions');
  const version = { id: 'draft-14', attributes: { versionString: '1.4.0', platform: 'IOS', appStoreState: state }, relationships: { build: { data: null } } };
  const locale = { id: 'english', attributes: { locale: 'en-US' } };
  globalThis.__ascFixture = {
    sanitized: value => value,
    async asc(path, method = 'GET', data) {
      calls.push({ path, method, data });
      if (method !== 'GET') return { data };
      if (path.startsWith('/v1/apps/6778942533/appStoreVersions')) return { data: [version] };
      if (path.includes('/appStoreVersionLocalizations?')) return { data: [locale] };
      if (path.includes('/appScreenshotSets?') || path.includes('/appPreviewSets?')) return { data: [] };
      if (path.startsWith('/v1/builds?')) return { data: [{ id: 'build-77', attributes: { processingState: processing }, relationships: { preReleaseVersion: { data: { id: 'train' } } } }], included: [{ id: 'train', attributes: { version: buildVersion } }] };
      if (path.endsWith('/appStoreReviewDetail')) return { data: { id: 'review' } };
      if (path.startsWith('/v1/appStoreVersions/draft-14?')) return { data: version };
      if (path === '/v1/appStoreVersionLocalizations/english') return { data: locale };
      throw Error('Unexpected request: ' + path);
    },
  };
  const previous = { ...process.env };
  process.env.PREPARE_STORE = prepare ? '1' : '0';
  process.env.UPLOAD_STORE_MEDIA = '0';
  process.env.STORE_BUILD_NUMBER = '77';
  process.chdir(dir);
  let error;
  try { await import('data:text/javascript;base64,' + Buffer.from(source + `\n// fixture ${sequence++}`).toString('base64')); }
  catch (e) { error = e; }
  finally { process.chdir(root); for (const key of ['PREPARE_STORE', 'UPLOAD_STORE_MEDIA', 'STORE_BUILD_NUMBER']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } delete globalThis.__ascFixture; }
  return { calls, error };
}

await test('inspection does not mutate store state', async () => {
  const { calls, error } = await exercise(); assert.ifError(error);
  assert.ok(calls.every(c => c.method === 'GET'));
});
await test('submitted versions cannot be changed', async () => {
  const { calls, error } = await exercise({ prepare: true, state: 'WAITING_FOR_REVIEW' });
  assert.match(error.message, /editable/); assert.ok(calls.every(c => c.method === 'GET'));
});
for (const options of [{ buildVersion: '1.3.0' }, { processing: 'PROCESSING' }]) await test('wrong train or unprocessed build fails before mutation: ' + JSON.stringify(options), async () => {
  const { calls, error } = await exercise({ prepare: true, ...options });
  assert.match(error.message, /not a valid/); assert.ok(calls.every(c => c.method === 'GET'));
});
await test('valid draft preparation changes only notes and build, never submits', async () => {
  const { calls, error } = await exercise({ prepare: true }); assert.ifError(error);
  const changes = calls.filter(c => c.method !== 'GET');
  assert.deepEqual(changes.map(c => [c.method, c.path]), [
    ['PATCH', '/v1/appStoreVersionLocalizations/english'],
    ['PATCH', '/v1/appStoreReviewDetails/review'],
    ['PATCH', '/v1/appStoreVersions/draft-14/relationships/build'],
  ]);
  assert.equal(changes[0].data.attributes.whatsNew, 'New release notes');
  assert.deepEqual(changes[2].data, { type: 'builds', id: 'build-77' });
});
