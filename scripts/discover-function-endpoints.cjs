// scripts/discover-function-endpoints.cjs
// Discovers all deployed exports with the real installed Firebase SDK, without invoking handlers.
// Makes region investigations reviewable by comparing complete endpoint manifests offline.
// RELEVANT FILES: functions/index.js, functions/package-lock.json, docs/firebase-function-regions.md
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Usage: node scripts/discover-function-endpoints.cjs [functions-directory] [baseline.json]
const functionsDir = path.resolve(process.argv[2] || path.join(__dirname, '../functions'));
const functionsRequire = createRequire(path.join(functionsDir, 'package.json'));
// Package exports hide package.json in SDK 7. Resolve the public v2 entry first.
const sdkPackage = path.resolve(path.dirname(functionsRequire.resolve('firebase-functions/v2')),
  '../../package.json');
const sdk = JSON.parse(fs.readFileSync(sdkPackage, 'utf8'));
const adminPackage = path.resolve(path.dirname(functionsRequire.resolve('firebase-admin/app')),
  '../../package.json');
const admin = JSON.parse(fs.readFileSync(adminPackage, 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(functionsDir, 'package-lock.json'), 'utf8'));

assert.equal(process.versions.node.split('.')[0], '22', 'Run discovery on Node.js 22');
for (const [name, installed] of [['firebase-functions', sdk], ['firebase-admin', admin]]) {
  assert.equal(installed.version, lock.packages[`node_modules/${name}`].version,
    `${name}: run npm ci in the functions directory first`);
}

const expectedKinds = {
  createBooking: 'callableTrigger',
  joinWaitlist: 'callableTrigger',
  leaveWaitlist: 'callableTrigger',
  cancelBooking: 'callableTrigger',
  sendDirectNotification: 'callableTrigger',
  backfillEmailLower: 'callableTrigger',
  resetAllStrikes: 'callableTrigger',
  onBookingCreate: 'eventTrigger',
  onBookingCreateTotalPass: 'eventTrigger',
  onBookingDelete: 'eventTrigger',
  onUserUnlockNotification: 'eventTrigger',
  sendBookingReminder: 'taskQueueTrigger',
  sendTotalPassReminder: 'taskQueueTrigger',
  onWaitlistExpiration: 'taskQueueTrigger',
  generateDailyClasses: 'scheduleTrigger',
  automaticWhitelisting: 'scheduleTrigger',
  resetMonthlySubscriptionStatuses: 'scheduleTrigger',
};

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
}

async function main() {
  // Use the SDK's own discovery and serialization, rather than stubbing trigger constructors.
  // These internal entry points may need updating when the SDK changes; failures must be visible.
  const runtime = path.join(path.dirname(sdkPackage), 'lib/runtime');
  const { loadStack } = require(path.join(runtime, 'loader.js'));
  const { stackToWire } = require(path.join(runtime, 'manifest.js'));
  const manifest = stackToWire(await loadStack(functionsDir));
  assert.deepEqual(Object.keys(manifest.endpoints).sort(), Object.keys(expectedKinds).sort());
  for (const [name, kind] of Object.entries(expectedKinds)) {
    const endpoint = manifest.endpoints[name];
    assert.equal(endpoint.platform, 'gcfv2', name);
    assert.ok(endpoint[kind], `${name}: expected ${kind}`);
  }
  // Compare the serialized wire format, where undefined properties are omitted.
  const snapshot = JSON.parse(JSON.stringify(sorted({
    nodeMajor: 22, sdkVersion: sdk.version, adminVersion: admin.version, manifest,
  })));
  if (process.argv[3]) {
    assert.deepEqual(snapshot, JSON.parse(fs.readFileSync(process.argv[3], 'utf8')),
      'Endpoint metadata differs from the baseline; review every changed field');
  }
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  console.error(`Discovered all 17 gcfv2 exports with firebase-functions ${sdk.version} / firebase-admin ${admin.version}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
