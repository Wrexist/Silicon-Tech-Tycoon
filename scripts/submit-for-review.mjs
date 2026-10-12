// Submits ONE App Store version for review — the only script in this repo that does. It runs only from
// the "Store submit" workflow, which the owner dispatches by hand, and only when CONFIRM repeats the
// version exactly. It submits just that version (no events, product pages or tests ride along).
import { mkdirSync, writeFileSync } from 'node:fs';
import { asc, sanitized } from './app-store-client.mjs';

const appId = '6778942533';
const versionString = process.env.SUBMIT_VERSION;
if (!/^\d+\.\d+(\.\d+)?$/.test(versionString || '')) throw Error('SUBMIT_VERSION must be a version like 1.4.1');
if (process.env.CONFIRM !== versionString) throw Error(`CONFIRM must repeat the version (${versionString}) to submit`);
mkdirSync('artifacts/store-submit', { recursive: true });

const versions = (await asc(`/v1/apps/${appId}/appStoreVersions?limit=50&include=build`)).data;
const version = versions.find(v => v.attributes.versionString === versionString && v.attributes.platform === 'IOS');
if (!version) throw Error(`No ${versionString} version`);
if (version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') throw Error(`${versionString} is ${version.attributes.appStoreState}, not a draft`);
if (!version.relationships?.build?.data?.id) throw Error(`${versionString} has no build selected`);

// Reuse an open, unsubmitted submission if one exists (Apple allows one per platform), else open one.
const open = (await asc(`/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW&limit=10`)).data;
const submission = open[0] ?? (await asc('/v1/reviewSubmissions', 'POST', { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: appId } } } })).data;
const items = (await asc(`/v1/reviewSubmissions/${submission.id}/items?limit=50&include=appStoreVersion`)).data;
const others = items.filter(i => i.relationships?.appStoreVersion?.data?.id !== version.id);
if (others.length) throw Error(`The open submission already holds ${others.length} other item(s); review it in App Store Connect first`);
if (!items.length) await asc('/v1/reviewSubmissionItems', 'POST', { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } });
const sent = (await asc(`/v1/reviewSubmissions/${submission.id}`, 'PATCH', { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } })).data;
writeFileSync('artifacts/store-submit/submission.json', JSON.stringify(sanitized(sent), null, 2));
console.log(`Submitted ${versionString} for review: submission ${sent.id} is ${sent.attributes.state}`);
