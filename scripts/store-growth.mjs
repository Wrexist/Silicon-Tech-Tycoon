// App Store reach for 1.4.0, as DRAFTS the owner reviews and submits in App Store Connect:
//   event      — the "The Factory Opens" in-app event (MAJOR_UPDATE) with its card + details art
//   nomination — an App Enhancements featuring nomination for 1.4.0, linked to that event
//   cpp        — two custom product pages: "Factory builders" (new 3D screenshots, factory first,
//                new trailer) and "Tycoon strategy" (the proven screenshots), each with its own keywords
//   promo      — reports the live promotional text (it is edited without review, so nothing is written)
// GROWTH=event,nomination,cpp,promo picks steps. Nothing is ever submitted; everything is re-runnable
// (it reuses a draft with the same name instead of creating a second one).
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { asc, sanitized } from './app-store-client.mjs';

const appId = '6778942533', versionString = '1.4.0', locale = 'en-US';
const steps = (process.env.GROWTH || 'event,nomination,cpp,promo').split(',');
const out = 'artifacts/store-growth';
mkdirSync(out, { recursive: true });
const save = (name, data) => writeFileSync(join(out, name + '.json'), JSON.stringify(sanitized(data), null, 2));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fit = (text, max, label) => { if (text.length > max) throw Error(`${label} is ${text.length} > ${max} chars`); return text; };
// Tentative dates: the owner moves them in App Store Connect once 1.4.0's release date is known.
const EVENT_START = process.env.EVENT_START || '2026-10-19T16:00:00Z';
const EVENT_END = process.env.EVENT_END || '2026-11-16T16:00:00Z';

// Fail before touching anything if a requested step can't finish (the Factory page needs media).
if (steps.includes('cpp') && !process.env.STORE_MEDIA_DIR) throw Error('The cpp step needs reviewed media: pass media_run_id (STORE_MEDIA_DIR)');

const report = {};
const versions = (await asc(`/v1/apps/${appId}/appStoreVersions?limit=50`)).data;
const version = versions.find(v => v.attributes.versionString === versionString && v.attributes.platform === 'IOS');
if (!version) throw Error('No 1.4.0 version');
report.version = version.attributes.appStoreState;

async function uploadParts(ops, bytes) {
  for (const op of ops) {
    const r = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])), body: bytes.subarray(op.offset, op.offset + op.length), signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw Error(`Upload part failed: ${r.status}`);
  }
}

// ---------- in-app event ----------
let eventId = null;
if (steps.includes('event') || steps.includes('nomination')) {
  const name = 'The Factory Opens';
  const existing = (await asc(`/v1/apps/${appId}/appEvents?limit=50`)).data;
  let event = existing.find(e => e.attributes.referenceName === 'Factory Opening 1.4');
  if (!event && steps.includes('event')) {
    const territories = [];
    for (let url = '/v1/territories?limit=200'; url;) {
      const page = await asc(url); territories.push(...page.data.map(t => t.id));
      url = page.links?.next ? page.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
    }
    event = (await asc('/v1/appEvents', 'POST', {
      type: 'appEvents',
      attributes: {
        referenceName: 'Factory Opening 1.4', badge: 'MAJOR_UPDATE', primaryLocale: locale, priority: 'HIGH', purpose: 'APPROPRIATE_FOR_ALL_USERS',
        territorySchedules: [{ territories, publishStart: EVENT_START, eventStart: EVENT_START, eventEnd: EVENT_END }],
      },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    })).data;
    console.log('Event created', event.id);
  }
  if (event) {
    eventId = event.id;
    if (steps.includes('event')) {
      const locs = (await asc(`/v1/appEvents/${event.id}/localizations?limit=50`)).data;
      const attrs = {
        name: fit(name, 30, 'event name'),
        shortDescription: fit('Build a 3D production line for your next device.', 50, 'event short description'),
        longDescription: fit('Place machines, route belts and watch your robot crew build every unit of your next launch in a 3D factory.', 120, 'event long description'),
      };
      let loc = locs.find(l => l.attributes.locale === locale);
      if (!loc) loc = (await asc('/v1/appEventLocalizations', 'POST', { type: 'appEventLocalizations', attributes: { locale, ...attrs }, relationships: { appEvent: { data: { type: 'appEvents', id: event.id } } } })).data;
      else await asc(`/v1/appEventLocalizations/${loc.id}`, 'PATCH', { type: 'appEventLocalizations', id: loc.id, attributes: attrs });
      const shots = (await asc(`/v1/appEventLocalizations/${loc.id}/appEventScreenshots?limit=10`)).data;
      for (const [file, kind] of [['appstore/creative-assets/event-card-3840x2160.png', 'EVENT_CARD'], ['appstore/creative-assets/event-details-2160x3840.png', 'EVENT_DETAILS_PAGE']]) {
        if (shots.some(s => s.attributes.appEventAssetType === kind && s.attributes.fileName === basename(file) && s.attributes.assetDeliveryState?.state === 'COMPLETE')) continue;
        for (const s of shots.filter(s => s.attributes.appEventAssetType === kind)) await asc(`/v1/appEventScreenshots/${s.id}`, 'DELETE');
        const bytes = readFileSync(file);
        const shot = (await asc('/v1/appEventScreenshots', 'POST', { type: 'appEventScreenshots', attributes: { fileName: basename(file), fileSize: bytes.length, appEventAssetType: kind }, relationships: { appEventLocalization: { data: { type: 'appEventLocalizations', id: loc.id } } } })).data;
        await uploadParts(shot.attributes.uploadOperations, bytes);
        await asc(`/v1/appEventScreenshots/${shot.id}`, 'PATCH', { type: 'appEventScreenshots', id: shot.id, attributes: { uploaded: true } });
        for (let i = 0; i < 60; i++) {
          const st = (await asc(`/v1/appEventScreenshots/${shot.id}`)).data.attributes.assetDeliveryState;
          if (st?.state === 'FAILED') throw Error(`${kind} failed: ${JSON.stringify(st.errors)}`);
          if (st?.state === 'COMPLETE') break;
          await wait(5000);
        }
        console.log('Event art', kind);
      }
      report.event = { id: event.id, state: (await asc(`/v1/appEvents/${event.id}`)).data.attributes.eventState, start: EVENT_START, end: EVENT_END };
    }
  }
}

// ---------- featuring nomination ----------
if (steps.includes('nomination')) {
  const name = 'Silicon 1.4: 3D Office and Factory';
  // filter[state] is required by the endpoint; a draft is the only kind this script may reuse.
  const existing = (await asc(`/v1/nominations?filter[state]=DRAFT&filter[relatedApps]=${appId}&limit=50`)).data;
  const sent = (await asc(`/v1/nominations?filter[state]=SUBMITTED&filter[relatedApps]=${appId}&limit=50`)).data;
  const description = fit([
    'Silicon is a tech-tycoon sim where you design devices down to the chip, grow a company and outplay rivals.',
    'Version 1.4 is our biggest update: a fully 3D office where a team of expressive robot staff works, takes breaks and grows with you, and a 3D factory where players place machines, route conveyor belts and watch their own production line build every launch.',
    'Research and production now progress smoothly in real time, and a new 3D quality setting keeps older iPhones running cool.',
    'Free to download with an optional subscription that sells content and modes, never an in-run advantage. No ads, no tracking, no accounts.',
  ].join(' '), 1000, 'nomination description');
  const notes = 'Built for iPhone and iPad (phone and tablet layouts). Honours Reduce Motion, offers adjustable text size and a 3D quality setting for older devices. The game is fully offline and deterministic; saves never leave the device.';
  const attributes = { name, type: 'APP_ENHANCEMENTS', description, notes, submitted: false, publishStartDate: EVENT_START, deviceFamilies: ['IPHONE', 'IPAD'], locales: [locale], hasInAppEvents: !!eventId, launchInSelectMarketsFirst: false, preOrderEnabled: false };
  const relationships = { relatedApps: { data: [{ type: 'apps', id: appId }] }, ...(eventId ? { inAppEvents: { data: [{ type: 'appEvents', id: eventId }] } } : {}) };
  if (sent.some(n => n.attributes.name === name)) throw Error(`Nomination "${name}" is already submitted`);
  const same = existing.find(n => n.attributes.name === name);
  let nomination;
  if (same) {
    const { submitted, ...rest } = attributes;
    nomination = (await asc(`/v1/nominations/${same.id}`, 'PATCH', { type: 'nominations', id: same.id, attributes: rest, relationships })).data;
  } else nomination = (await asc('/v1/nominations', 'POST', { type: 'nominations', attributes, relationships })).data;
  report.nomination = { id: nomination.id, state: nomination.attributes.state, submitted: nomination.attributes.submitted };
  console.log('Nomination draft', nomination.id, nomination.attributes.state);
}

// ---------- custom product pages ----------
async function fillSets(locId, root) {
  const order = ['02-factory', '01-office', '03-design', '04-research', '05-market', '06-company'];
  const plan = [
    ['appScreenshotSets', 'appScreenshots', 'screenshotDisplayType', 'APP_IPHONE_67', order.map(n => join(root, 'iphone', n + '.png'))],
    ['appScreenshotSets', 'appScreenshots', 'screenshotDisplayType', 'APP_IPAD_PRO_3GEN_129', order.map(n => join(root, 'ipad', n + '.png'))],
    ['appPreviewSets', 'appPreviews', 'previewType', 'IPHONE_67', [join(root, 'preview', 'Silicon-1.4.0-iPhone.mp4')]],
  ];
  const owner = { appCustomProductPageLocalization: { data: { type: 'appCustomProductPageLocalizations', id: locId } } };
  for (const [sets, assets, attribute, value, files] of plan) {
    const relationship = sets === 'appScreenshotSets' ? 'appScreenshotSet' : 'appPreviewSet';
    const current = (await asc(`/v1/appCustomProductPageLocalizations/${locId}/${sets}?limit=50`)).data;
    const set = current.find(s => s.attributes[attribute] === value) ?? (await asc(`/v1/${sets}`, 'POST', { type: sets, attributes: { [attribute]: value }, relationships: owner })).data;
    const sums = files.map(f => createHash('md5').update(readFileSync(f)).digest('hex'));
    // The template seeds this page with copies of the default media; they live only on this page.
    for (const a of (await asc(`/v1/${sets}/${set.id}/${assets}?limit=50`)).data) {
      if (!sums.includes(a.attributes.sourceFileChecksum) || a.attributes.assetDeliveryState?.state !== 'COMPLETE') await asc(`/v1/${assets}/${a.id}`, 'DELETE');
    }
    const have = (await asc(`/v1/${sets}/${set.id}/${assets}?limit=50`)).data;
    const ids = [];
    for (const [i, file] of files.entries()) {
      // only a fully delivered asset is reusable; anything else was cleared above and is re-uploaded
      const done = have.find(a => a.attributes.sourceFileChecksum === sums[i] && a.attributes.assetDeliveryState?.state === 'COMPLETE');
      if (done) { ids.push(done.id); continue; }
      const bytes = readFileSync(file);
      const attrs = { fileName: basename(file), fileSize: bytes.length, ...(assets === 'appPreviews' ? { mimeType: 'video/mp4', previewFrameTimeCode: '00:00:03:00' } : {}) };
      const r = (await asc(`/v1/${assets}`, 'POST', { type: assets, attributes: attrs, relationships: { [relationship]: { data: { type: sets, id: set.id } } } })).data;
      await uploadParts(r.attributes.uploadOperations, bytes);
      await asc(`/v1/${assets}/${r.id}`, 'PATCH', { type: assets, id: r.id, attributes: { uploaded: true, sourceFileChecksum: sums[i] } });
      let ready = false;
      for (let k = 0; k < 100 && !ready; k++) {
        const a = (await asc(`/v1/${assets}/${r.id}`)).data.attributes;
        const states = [a.assetDeliveryState, ...(assets === 'appPreviews' ? [a.videoDeliveryState] : [])];
        if (states.some(s => s?.state === 'FAILED')) throw Error(`${basename(file)} failed`);
        ready = states.every(s => s?.state === 'COMPLETE');
        if (!ready) await wait(6000);
      }
      if (!ready) throw Error(`${basename(file)} is still processing; rerun to retry it`);
      ids.push(r.id);
    }
    await asc(`/v1/${sets}/${set.id}/relationships/${assets}`, 'PATCH', ids.map(id => ({ type: assets, id })));
    console.log('CPP media', value, files.length);
  }
  // seeded copies of other sizes would show the old images on smaller devices
  for (const [sets, attribute, keep] of [['appScreenshotSets', 'screenshotDisplayType', ['APP_IPHONE_67', 'APP_IPAD_PRO_3GEN_129']], ['appPreviewSets', 'previewType', ['IPHONE_67']]]) {
    for (const s of (await asc(`/v1/appCustomProductPageLocalizations/${locId}/${sets}?limit=50`)).data) if (!keep.includes(s.attributes[attribute])) await asc(`/v1/${sets}/${s.id}`, 'DELETE');
  }
}

if (steps.includes('cpp')) {
  // appKeywords carry no attributes: the resource id is the keyword itself (scoped by locale).
  const keywords = await asc(`/v1/apps/${appId}/searchKeywords?filter[platform]=IOS&filter[locale]=${locale}&limit=200`);
  save('app-keywords', keywords);
  const pages = (await asc(`/v1/apps/${appId}/appCustomProductPages?limit=50`)).data;
  const PAGES = [
    { name: 'Factory builders', media: true, words: ['factory', 'builder', 'simulation', 'management', 'strategy', 'idle'],
      promo: 'Design a device, then build the 3D production line that makes it: place machines, route belts and watch your robot crew ship every unit.' },
    { name: 'Tycoon strategy', media: false, words: ['business', 'startup', 'mogul', 'magnate', 'ceo', 'invest', 'strategy'],
      promo: 'Start in a garage, outplay rival tech giants and take your company public. Every device, price and hire is your call.' },
  ];
  report.cpp = [];
  for (const p of PAGES) {
    fit(p.promo, 170, `${p.name} promo text`);
    let page = pages.find(x => x.attributes.name === p.name);
    if (!page) {
      page = (await asc('/v1/appCustomProductPages', 'POST', {
        type: 'appCustomProductPages', attributes: { name: p.name },
        relationships: { app: { data: { type: 'apps', id: appId } }, appCustomProductPageVersions: { data: [{ type: 'appCustomProductPageVersions', id: '${v}' }] }, appStoreVersionTemplate: { data: { type: 'appStoreVersions', id: version.id } } },
      }, [
        { type: 'appCustomProductPageVersions', id: '${v}', relationships: { appCustomProductPageLocalizations: { data: [{ type: 'appCustomProductPageLocalizations', id: '${l}' }] } } },
        { type: 'appCustomProductPageLocalizations', id: '${l}', attributes: { locale, promotionalText: p.promo } },
      ])).data;
      console.log('CPP created', p.name, page.id);
    }
    const pv = (await asc(`/v1/appCustomProductPages/${page.id}/appCustomProductPageVersions?limit=10`)).data;
    const editable = pv.find(v => v.attributes.state === 'PREPARE_FOR_SUBMISSION') ?? pv[0];
    const locs = (await asc(`/v1/appCustomProductPageVersions/${editable.id}/appCustomProductPageLocalizations?limit=50`)).data;
    const loc = locs.find(l => l.attributes.locale === locale) ?? locs[0];
    await asc(`/v1/appCustomProductPageLocalizations/${loc.id}`, 'PATCH', { type: 'appCustomProductPageLocalizations', id: loc.id, attributes: { promotionalText: p.promo } });
    const word = k => { try { return decodeURIComponent(k.id).trim().toLowerCase(); } catch { return k.id.toLowerCase(); } };
    const ids = keywords.data.filter(k => p.words.includes(word(k))).map(k => ({ type: 'appKeywords', id: k.id }));
    // Never claim keywords silently: an unmatched list is reported so the owner can pick in ASC.
    if (!ids.length) throw Error(`${p.name}: none of ${p.words.join(', ')} matched the app's keyword ids (${keywords.data.slice(0, 20).map(k => k.id).join(', ')})`);
    await asc(`/v1/appCustomProductPageLocalizations/${loc.id}/relationships/searchKeywords`, 'POST', ids);
    const linked = ids.length;
    if (p.media) {
      if (!process.env.STORE_MEDIA_DIR) throw Error('Factory page needs STORE_MEDIA_DIR');
      await fillSets(loc.id, process.env.STORE_MEDIA_DIR);
    }
    report.cpp.push({ name: p.name, id: page.id, versionState: editable.attributes.state, keywordsLinked: linked, keywordsWanted: p.words });
  }
}

// ---------- promotional text (read only) ----------
if (steps.includes('promo')) {
  const live = versions.find(v => ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'].includes(v.attributes.appStoreState));
  const read = async v => v ? (await asc(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=200`)).data.find(l => l.attributes.locale === locale)?.attributes.promotionalText : null;
  report.promo = { live: await read(live), next: await read(version), repo: readFileSync('appstore/localizations/en-US/promotional_text.txt', 'utf8').trim() };
}

save('report', report);
console.log(JSON.stringify(report, null, 2));
