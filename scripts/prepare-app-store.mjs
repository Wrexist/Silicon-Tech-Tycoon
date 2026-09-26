// Update only the existing editable 1.4.0 draft. Never submit or release a version.
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { asc, sanitized } from './app-store-client.mjs';

const appId = '6778942533', versionString = '1.4.0';
const out = 'artifacts/app-store-preparation';
mkdirSync(out, { recursive: true });
const save = (name, data) => writeFileSync(join(out, name + '.json'), JSON.stringify(sanitized(data), null, 2));
const versions = await asc(`/v1/apps/${appId}/appStoreVersions?limit=50&include=build`);
const version = versions.data.find(v => v.attributes.versionString === versionString && v.attributes.platform === 'IOS');
if (!version || version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') throw Error('Expected editable iOS 1.4.0 draft');
const locales = await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`);
const locale = locales.data.find(l => l.attributes.locale === 'en-US');
if (!locale) throw Error('Expected existing en-US localization');

async function mediaOverview() {
  const result = {};
  for (const [sets, assets] of [['appScreenshotSets', 'appScreenshots'], ['appPreviewSets', 'appPreviews']]) {
    const groups = await asc(`/v1/appStoreVersionLocalizations/${locale.id}/${sets}?limit=200`);
    result[sets] = [];
    for (const group of groups.data) {
      const files = await asc(`/v1/${sets}/${group.id}/${assets}?limit=50`);
      result[sets].push({ ...group, assets: files.data });
    }
  }
  return result;
}
const before = { version, locales, media: await mediaOverview() };
save('before', before);
console.log('Existing media:', Object.fromEntries(Object.entries(before.media).map(([k, groups]) => [k, groups.map(g => ({ id: g.id, ...g.attributes, files: g.assets.map(a => ({ id: a.id, name: a.attributes.fileName, state: a.attributes.assetDeliveryState })) }))])));

if (process.env.PREPARE_STORE === '1') {
  const buildNumber = process.env.STORE_BUILD_NUMBER;
  if (!/^\d+$/.test(buildNumber || '')) throw Error('Explicit build number required');
  const builds = await asc(`/v1/builds?filter[app]=${appId}&filter[version]=${buildNumber}&include=preReleaseVersion`);
  const build = builds.data.find(b => b.attributes.processingState === 'VALID' && builds.included?.some(p => p.id === b.relationships?.preReleaseVersion?.data?.id && p.attributes.version === versionString));
  if (!build) throw Error(`Build ${buildNumber} is not a valid 1.4.0 build`);
  const whatsNew = readFileSync('appstore/localizations/en-US/release_notes.txt', 'utf8').trim();
  if (!whatsNew || whatsNew.length > 4000) throw Error('Invalid release notes');
  // GitHub Pages project paths are case-sensitive; the previous lowercase URL returned 404.
  const marketingUrl = 'https://wrexist.github.io/Silicon-Tech-Tycoon/';
  await asc(`/v1/appStoreVersionLocalizations/${locale.id}`, 'PATCH', { type: 'appStoreVersionLocalizations', id: locale.id, attributes: { whatsNew, marketingUrl } });
  const review = (await asc(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  const notes = readFileSync('appstore/review-notes-1.4.0.txt', 'utf8').trim();
  if (!notes || notes.length > 4000) throw Error('Invalid review notes');
  await asc(`/v1/appStoreReviewDetails/${review.id}`, 'PATCH', { type: 'appStoreReviewDetails', id: review.id, attributes: { notes } });
  await asc(`/v1/appStoreVersions/${version.id}/relationships/build`, 'PATCH', { type: 'builds', id: build.id });
  console.log(`Updated draft release notes and selected build ${buildNumber}`);
}

// Media is supplied as an explicitly reviewed, pinned Actions artifact. Existing assets are
// retained unless identical or a replacement has finished processing. No unrelated set is deleted.
if (process.env.UPLOAD_STORE_MEDIA === '1') {
  const root = process.env.STORE_MEDIA_DIR;
  if (!root) throw Error('Missing reviewed media directory');
  const capture = JSON.parse(readFileSync(join(root, 'capture-report.json'), 'utf8'));
  if (capture.errors.length || capture.captures.length !== 12) throw Error('Expected 12 successful screenshot captures');
  // Back up all current draft screenshots before making room in Apple's ten-image sets.
  const backup = join(out, 'previous-screenshots'); mkdirSync(backup, { recursive: true });
  for (const set of before.media.appScreenshotSets) for (const asset of set.assets) {
    const image = asset.attributes.imageAsset;
    if (!image?.templateUrl) throw Error(`Cannot back up existing image ${asset.id}`);
    const url = image.templateUrl.replace('{w}', image.width).replace('{h}', image.height).replace('{f}', 'png');
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`Screenshot backup failed: ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error(`Invalid PNG backup for ${asset.id}`);
    writeFileSync(join(backup, `${asset.id}.png`), bytes);
  }
  async function upload(set, sets, assets, files) {
    const relationship = sets === 'appScreenshotSets' ? 'appScreenshotSet' : 'appPreviewSet';
    const old = (await asc(`/v1/${sets}/${set.id}/${assets}?limit=50`)).data;
    const completed = [];
    const removed = new Set();
    async function waitForDelivery(id) {
      let ready;
      for (let attempt = 0; attempt < 100; attempt++) {
        ready = (await asc(`/v1/${assets}/${id}`)).data;
        const states = [ready.attributes.assetDeliveryState];
        if (assets === 'appPreviews') states.push(ready.attributes.videoDeliveryState, ready.attributes.previewFrameImage?.state);
        if (states.some(state => state?.state === 'FAILED')) throw Error(`Processing failed: ${JSON.stringify(states)}`);
        if (states.every(state => state?.state === 'COMPLETE')) return ready;
        await new Promise(r => setTimeout(r, 6000));
      }
      throw Error(`Asset or preview delivery is still processing: ${id}; preserved for inspection`);
    }
    for (const file of files) {
      const bytes = readFileSync(file), checksum = createHash('md5').update(bytes).digest('hex');
      const same = old.find(a => a.attributes.sourceFileChecksum === checksum && a.attributes.assetDeliveryState?.state === 'COMPLETE');
      if (same) { completed.push(await waitForDelivery(same.id)); continue; }
      // A full screenshot set cannot accept an eleventh image. Retire one backed-up old
      // image at a time, retaining the rest until every replacement is processed.
      if (assets === 'appScreenshots' && old.length - removed.size + completed.filter(a => !old.some(o => o.id === a.id)).length >= 10) {
        const replace = old.find(a => !removed.has(a.id) && !completed.some(c => c.id === a.id));
        if (!replace) throw Error('No replaceable screenshot slot');
        await asc(`/v1/${assets}/${replace.id}`, 'DELETE'); removed.add(replace.id);
      }
      const attributes = { fileName: basename(file), fileSize: bytes.length, ...(assets === 'appPreviews' ? { mimeType: 'video/mp4', previewFrameTimeCode: '00:00:05:00' } : {}) };
      const reservation = (await asc(`/v1/${assets}`, 'POST', { type: assets, attributes, relationships: { [relationship]: { data: { type: sets, id: set.id } } } })).data;
      // Persist safe reservation IDs immediately so an interrupted upload is diagnosable.
      save(`reservation-${reservation.id}`, reservation);
      for (const op of reservation.attributes.uploadOperations) {
        const response = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])), body: bytes.subarray(op.offset, op.offset + op.length), signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw Error(`Asset part upload failed: ${response.status}`);
      }
      await asc(`/v1/${assets}/${reservation.id}`, 'PATCH', { type: assets, id: reservation.id, attributes: { uploaded: true, sourceFileChecksum: checksum } });
      const ready = await waitForDelivery(reservation.id);
      completed.push(ready);
      console.log('Processed', assets, basename(file));
    }
    // Only superseded files in the two target sizes are replaced; their original URLs and
    // metadata are preserved in before.json. Live 1.3.0 media is never touched.
    for (const asset of old) if (!removed.has(asset.id) && !completed.some(a => a.id === asset.id)) await asc(`/v1/${assets}/${asset.id}`, 'DELETE');
    await asc(`/v1/${sets}/${set.id}/relationships/${assets}`, 'PATCH', completed.map(a => ({ type: assets, id: a.id })));
  }
  for (const [device, displayType] of [['iphone', 'APP_IPHONE_67'], ['ipad', 'APP_IPAD_PRO_3GEN_129']]) {
    let set = before.media.appScreenshotSets.find(s => s.attributes.screenshotDisplayType === displayType);
    if (!set) set = (await asc('/v1/appScreenshotSets', 'POST', { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locale.id } } } })).data;
    const files = readdirSync(join(root, device)).filter(f => /^\d\d-.*\.png$/.test(f)).sort().map(f => join(root, device, f));
    if (files.length !== 6) throw Error(`Expected six ${device} screenshots`);
    await upload(set, 'appScreenshotSets', 'appScreenshots', files);
  }
  // The reviewed 6.9-inch set now supplies Apple's smaller iPhone sizes. Remove the
  // superseded 6.5-inch override from this draft so users don't see stale marketing.
  for (const set of before.media.appScreenshotSets.filter(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_65')) {
    await asc(`/v1/appScreenshotSets/${set.id}`, 'DELETE');
  }
  let previews = before.media.appPreviewSets.find(s => s.attributes.previewType === 'IPHONE_67');
  if (!previews) previews = (await asc('/v1/appPreviewSets', 'POST', { type: 'appPreviewSets', attributes: { previewType: 'IPHONE_67' }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locale.id } } } })).data;
  await upload(previews, 'appPreviewSets', 'appPreviews', [join(root, 'preview', 'Silicon-1.4.0-iPhone.mp4')]);
}
const after = { version: await asc(`/v1/appStoreVersions/${version.id}?include=build`), locale: await asc(`/v1/appStoreVersionLocalizations/${locale.id}`), media: await mediaOverview() };
save('after', after);
console.log('Draft state:', after.version.data.attributes.appStoreState, 'build:', after.version.data.relationships?.build?.data?.id);
