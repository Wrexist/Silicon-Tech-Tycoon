// Put a reviewed Store media artifact into a Product Page Optimization A/B test as ONE treatment,
// leaving the live product page (the control) and the 1.4.0 draft's media untouched. The test is
// created and filled, never submitted or started: Apple reviews treatments, and starting the test
// is the owner's call in App Store Connect.
//
// Re-runnable: it reuses an unsubmitted test with the same name, and skips any file whose checksum
// is already in the treatment's set.
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { asc, sanitized } from './app-store-client.mjs';

const appId = '6778942533';
const testName = process.env.EXPERIMENT_NAME || 'Product page 1.4.0';
const treatmentName = 'New 3D screenshots';
const locale = 'en-US';
// Share of App Store traffic in the test, split evenly between the original page and the treatment.
// 50 keeps three quarters of visitors on the current, proven screenshots while the test runs.
const trafficProportion = Number(process.env.EXPERIMENT_TRAFFIC || 50);
if (!Number.isInteger(trafficProportion) || trafficProportion < 1 || trafficProportion > 100) throw Error('Traffic must be 1-100');

const out = 'artifacts/app-store-experiment';
mkdirSync(out, { recursive: true });
const save = (name, data) => writeFileSync(join(out, name + '.json'), JSON.stringify(sanitized(data), null, 2));

const root = process.env.STORE_MEDIA_DIR;
if (!root) throw Error('Missing reviewed media directory');
const capture = JSON.parse(readFileSync(join(root, 'capture-report.json'), 'utf8'));
if (capture.errors.length || capture.captures.length !== 12) throw Error('Expected 12 successful screenshot captures');
const shots = device => {
  const files = readdirSync(join(root, device)).filter(f => /^\d\d-.*\.png$/.test(f)).sort().map(f => join(root, device, f));
  if (files.length !== 6) throw Error(`Expected six ${device} screenshots`);
  return files;
};

// 1. The test: reuse an editable one with this name, never touch a submitted/running/finished one.
const existing = (await asc(`/v1/apps/${appId}/appStoreVersionExperimentsV2?limit=50`)).data;
save('experiments-before', existing);
const same = existing.filter(e => e.attributes.name === testName);
if (same.some(e => e.attributes.state !== 'PREPARE_FOR_SUBMISSION')) throw Error(`A test named "${testName}" is already submitted or running; pick a new EXPERIMENT_NAME`);
const experiment = same[0] ?? (await asc('/v2/appStoreVersionExperiments', 'POST', {
  type: 'appStoreVersionExperiments',
  attributes: { name: testName, platform: 'IOS', trafficProportion },
  relationships: { app: { data: { type: 'apps', id: appId } } },
})).data;
if (experiment.attributes.trafficProportion !== trafficProportion) {
  await asc(`/v2/appStoreVersionExperiments/${experiment.id}`, 'PATCH', { type: 'appStoreVersionExperiments', id: experiment.id, attributes: { trafficProportion } });
}
console.log('Test:', experiment.id, testName, `${trafficProportion}% of traffic`);

// 2. One treatment (the original page is Apple's implicit control) with an en-US localization.
const treatments = (await asc(`/v2/appStoreVersionExperiments/${experiment.id}/appStoreVersionExperimentTreatments?limit=10`)).data;
const treatment = treatments.find(t => t.attributes.name === treatmentName) ?? (await asc('/v1/appStoreVersionExperimentTreatments', 'POST', {
  type: 'appStoreVersionExperimentTreatments',
  attributes: { name: treatmentName },
  relationships: { appStoreVersionExperimentV2: { data: { type: 'appStoreVersionExperiments', id: experiment.id } } },
})).data;
const localizations = (await asc(`/v1/appStoreVersionExperimentTreatments/${treatment.id}/appStoreVersionExperimentTreatmentLocalizations?limit=200`)).data;
const localization = localizations.find(l => l.attributes.locale === locale) ?? (await asc('/v1/appStoreVersionExperimentTreatmentLocalizations', 'POST', {
  type: 'appStoreVersionExperimentTreatmentLocalizations',
  attributes: { locale },
  relationships: { appStoreVersionExperimentTreatment: { data: { type: 'appStoreVersionExperimentTreatments', id: treatment.id } } },
})).data;
const owner = { appStoreVersionExperimentTreatmentLocalization: { data: { type: 'appStoreVersionExperimentTreatmentLocalizations', id: localization.id } } };

// 3. Media into the treatment's own sets.
async function waitForDelivery(assets, id) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const ready = (await asc(`/v1/${assets}/${id}`)).data;
    const states = [ready.attributes.assetDeliveryState];
    if (assets === 'appPreviews') states.push(ready.attributes.videoDeliveryState, ready.attributes.previewFrameImage?.state);
    if (states.some(s => s?.state === 'FAILED')) throw Error(`Processing failed: ${JSON.stringify(states)}`);
    if (states.every(s => s?.state === 'COMPLETE')) return ready;
    await new Promise(r => setTimeout(r, 6000));
  }
  throw Error(`Still processing: ${id}`);
}
async function fill(sets, assets, attribute, value, files) {
  const relationship = sets === 'appScreenshotSets' ? 'appScreenshotSet' : 'appPreviewSet';
  const current = (await asc(`/v1/appStoreVersionExperimentTreatmentLocalizations/${localization.id}/${sets}?limit=50`)).data;
  const set = current.find(s => s.attributes[attribute] === value) ?? (await asc(`/v1/${sets}`, 'POST', { type: sets, attributes: { [attribute]: value }, relationships: owner })).data;
  const sums = files.map(file => createHash('md5').update(readFileSync(file)).digest('hex'));
  // Apple seeds a new treatment with COPIES of the original page's media (a full set of ten blocks
  // any upload). Clear those copies first; they live only in this treatment, never on the live page.
  for (const asset of (await asc(`/v1/${sets}/${set.id}/${assets}?limit=50`)).data) {
    if (!sums.includes(asset.attributes.sourceFileChecksum) || asset.attributes.assetDeliveryState?.state !== 'COMPLETE') await asc(`/v1/${assets}/${asset.id}`, 'DELETE');
  }
  const old = (await asc(`/v1/${sets}/${set.id}/${assets}?limit=50`)).data;
  const order = [];
  for (const [i, file] of files.entries()) {
    const bytes = readFileSync(file), checksum = sums[i];
    const done = old.find(a => a.attributes.sourceFileChecksum === checksum && a.attributes.assetDeliveryState?.state === 'COMPLETE');
    if (done) { order.push(done.id); continue; }
    const attributes = { fileName: basename(file), fileSize: bytes.length, ...(assets === 'appPreviews' ? { mimeType: 'video/mp4', previewFrameTimeCode: '00:00:05:00' } : {}) };
    const reservation = (await asc(`/v1/${assets}`, 'POST', { type: assets, attributes, relationships: { [relationship]: { data: { type: sets, id: set.id } } } })).data;
    save(`reservation-${reservation.id}`, reservation);
    for (const op of reservation.attributes.uploadOperations) {
      const response = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])), body: bytes.subarray(op.offset, op.offset + op.length), signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw Error(`Asset part upload failed: ${response.status}`);
    }
    await asc(`/v1/${assets}/${reservation.id}`, 'PATCH', { type: assets, id: reservation.id, attributes: { uploaded: true, sourceFileChecksum: checksum } });
    order.push((await waitForDelivery(assets, reservation.id)).id);
    console.log('Processed', value, basename(file));
  }
  for (const asset of old) if (!order.includes(asset.id)) await asc(`/v1/${assets}/${asset.id}`, 'DELETE');
  await asc(`/v1/${sets}/${set.id}/relationships/${assets}`, 'PATCH', order.map(id => ({ type: assets, id })));
}
await fill('appScreenshotSets', 'appScreenshots', 'screenshotDisplayType', 'APP_IPHONE_67', shots('iphone'));
await fill('appScreenshotSets', 'appScreenshots', 'screenshotDisplayType', 'APP_IPAD_PRO_3GEN_129', shots('ipad'));
await fill('appPreviewSets', 'appPreviews', 'previewType', 'IPHONE_67', [join(root, 'preview', 'Silicon-1.4.0-iPhone.mp4')]);
// Drop the seeded copies of every OTHER size from the treatment (e.g. a 6.5-inch set), so smaller
// devices see the new set scaled down rather than the original page's old images.
for (const [sets, attribute, keep] of [['appScreenshotSets', 'screenshotDisplayType', ['APP_IPHONE_67', 'APP_IPAD_PRO_3GEN_129']], ['appPreviewSets', 'previewType', ['IPHONE_67']]]) {
  for (const set of (await asc(`/v1/appStoreVersionExperimentTreatmentLocalizations/${localization.id}/${sets}?limit=50`)).data) {
    if (!keep.includes(set.attributes[attribute])) { await asc(`/v1/${sets}/${set.id}`, 'DELETE'); console.log('Removed seeded', set.attributes[attribute]); }
  }
}

const after = (await asc(`/v2/appStoreVersionExperiments/${experiment.id}`)).data;
save('experiment-after', after);
console.log('Ready for review in App Store Connect (not submitted, not started):', after.attributes.state);
