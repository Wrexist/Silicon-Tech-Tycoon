import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const project = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
const versions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1].replaceAll('"', '').trim());
const requested = process.env.MARKETING_VERSION || pkg.version;
if (!/^\d+\.\d+(?:\.\d+)?$/.test(requested)) throw Error('Invalid marketing version');
if (versions.length !== 2 || [pkg.version, lock.version, lock.packages[''].version, ...versions].some(v => v !== requested)) {
  throw Error(`Release version mismatch: requested=${requested}, package=${pkg.version}, lock=${lock.version}, native=${versions.join(',')}. Update all sources before dispatch.`);
}
console.log(`PASS: release marketing version ${requested} agrees across package, lock and native configurations. Build-number availability must still be verified in App Store Connect.`);
