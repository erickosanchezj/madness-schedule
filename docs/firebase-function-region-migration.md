<!-- docs/firebase-function-region-migration.md -->
<!-- Defines the gated, staged handoff for four Firestore functions and rollback. -->
<!-- Preserves event capture and final names without silently moving other services. -->
<!-- RELEVANT FILES: docs/firebase-function-regions.md, functions/index.js, functions/src/bookingReminders.js, scripts/discover-function-endpoints.cjs -->

# Firestore function region migration runbook

**BLOCKED: do not execute mutation commands from this PR.** No migration is implemented or authorized by this document.
This is the operator procedure for a future reviewed migration after the [investigation prerequisites](firebase-function-regions.md) are satisfied.
All deployment/deletion commands below are instructions only; none were run during this investigation.

## 0. Required gates

Record a reviewed prerequisite commit as `SAFE_BASE`. It must retain today's 17 names and Iowa regions, and provide durable deduplication and recovery across all four handlers, task handlers, and all temporary/final names.
Deploy and verify those prerequisites on the **old** functions before adding any second subscription. A local claim store or a name-dependent key is insufficient.
Prove concurrent duplicate delivery, partial enqueue success, crash-after-push, stale/out-of-order events, booking recreation, and waitlist vacancy/expiration races in isolated tests.
Define operator recovery for ambiguous push outcomes. Rehearse both handoffs and rollback in a separate nonproduction project with synthetic data, test queues, and test notification sinks.

Confirm that project's actual Node.js 22 / Firebase CLI / Cloud Functions v2 deployment path supports Mexico Firestore functions.
Record a pinned CLI version, database location, deployed identities, IAM, retention/retry behavior, and the rehearsal results.
Cloud Run/Eventarc location listings and SDK discovery alone do not pass this gate.
Do not use production writes, notifications, or task enqueueing as availability probes.

Assign an operator and observation window covering ordinary bookings, cancellations, TotalPass enqueueing, unlock transitions, and waitlist expiration.
Retain event/operation IDs and timestamps in access-controlled logs so capture and side effects can be reconciled across names and regions.
Define zero unexplained missing operations, zero extra vacancy allocations, and no unexplained duplicate pushes as acceptance criteria.
Confirm an auditable way to drain old deliveries; otherwise keep old functions and this migration blocked at the deletion gate.

## 1. Read-only production inventory

Use already authorized operator credentials. Run from the repository root with Node.js 22 and the rehearsed Firebase CLI on PATH.
Save output privately; deployed configuration and logs may contain sensitive values. Never commit credentials, task payloads, tokens, or raw production logs.

```bash
export PROJECT_ID=madnessscheds
export OLD_REGION=us-central1
export NEW_REGION=northamerica-south1
FUNCTIONS=(onBookingCreate onBookingCreateTotalPass onBookingDelete onUserUnlockNotification)
TASKS=(sendBookingReminder sendTotalPassReminder onWaitlistExpiration)
node --version
firebase --version
gcloud version
firebase functions:list --project "$PROJECT_ID" --json > /tmp/functions-before.json
gcloud firestore databases describe --database='(default)' --project "$PROJECT_ID" --format=json
gcloud eventarc locations list --project "$PROJECT_ID"
gcloud run regions list --project "$PROJECT_ID"
gcloud projects get-iam-policy "$PROJECT_ID" --format=json > /tmp/project-iam.json
gcloud services list --enabled --project "$PROJECT_ID"
for name in "${FUNCTIONS[@]}"; do
  gcloud functions describe "$name" --gen2 --region="$OLD_REGION" --project="$PROJECT_ID" --format=json > "/tmp/$name-before.json"
  trigger=$(gcloud functions describe "$name" --gen2 --region="$OLD_REGION" --project="$PROJECT_ID" --format='value(eventTrigger.trigger)')
  gcloud eventarc triggers describe "${trigger##*/}" --location="$NEW_REGION" --project="$PROJECT_ID" --format=json
  service=$(gcloud functions describe "$name" --gen2 --region="$OLD_REGION" --project="$PROJECT_ID" --format='value(serviceConfig.service)')
  gcloud run services get-iam-policy "${service##*/}" --region="$OLD_REGION" --project="$PROJECT_ID" --format=json
done
for name in "${TASKS[@]}"; do
  gcloud tasks queues describe "$name" --location="$OLD_REGION" --project="$PROJECT_ID" --format=json
  gcloud tasks queues get-iam-policy "$name" --location="$OLD_REGION" --project="$PROJECT_ID" --format=json
done
gcloud scheduler jobs list --location="$OLD_REGION" --project="$PROJECT_ID" --format=json
```

Stop if database location differs from Mexico, filters differ from the investigation, deployed resources/names differ, or a command lacks permission.
The Eventarc location argument assumes the reported Mexico trigger location; use the actual inventoried trigger location if different and reassess the migration first.
Check that all four are `ACTIVE`, use `nodejs22`, and target the intended default database/namespace/document patterns.
Record actual runtime and trigger service accounts, Cloud Run IAM policies, environment/secrets, networking, resource limits, and retry settings.
Inspect Pub/Sub subscription retry/retention, dead-letter configuration, oldest unacknowledged age and undelivered-message metrics using each trigger's `transport.pubsub.subscription`.

Validate Event Receiver, per-service Run Invoker, service-agent permissions, deployer act-as permissions, task enqueue/delete and invocation access, and Firestore/FCM access for those identities.
Inspect inherited IAM conditions/deny policies and location restrictions with the cloud administrator. This runbook does not grant roles or change identities.
Queue/service inventory must confirm the three fixed Iowa task targets and task identity/audience. Do not recreate or purge queues.

## 2. Freeze a safe baseline

Prevent unrelated function deployments during the handoff. Keep the prerequisite behavior in place throughout rollback.
Do not use this PR's current main SHA as `SAFE_BASE`: it does not contain the required idempotency work.

```bash
# Set SAFE_BASE to the reviewed, rehearsed prerequisite commit before continuing.
: "${SAFE_BASE:?Set SAFE_BASE to the verified prerequisite commit}"
git switch -c chore/firebase-region-rollout "$SAFE_BASE"
npm ci --prefix functions --ignore-scripts
npm test
node scripts/discover-function-endpoints.cjs functions > /tmp/region-safe-baseline.json
```

The four old subscriptions must already run the prerequisite version. Verify their deployed revision/source against `SAFE_BASE`.
Use the separately reviewed prerequisite deployment instructions if they do not. Do not introduce new subscriptions yet.

## 3. Stage A: temporary Mexico names, old Iowa functions retained

Build from the prerequisite source, changing only each Firestore constructor's `region` and its root exported name.
The following guarded edit applies to today's layout; if the prerequisite changes the layout, stop and review an equivalent edit rather than relaxing the assertions.
No task constructor, callable, schedule, queue target, retry policy, handler body, or identity should change.

```bash
python3 - <<'PY'
from pathlib import Path
pairs = {
    'onBookingCreate': 'bookingReminders.js',
    'onBookingCreateTotalPass': 'totalPassReminders.js',
    'onBookingDelete': 'waitlistNotifications.js',
    'onUserUnlockNotification': 'userUnlockNotifications.js',
}
index = Path('functions/index.js')
text = index.read_text()
for name, filename in pairs.items():
    source = Path('functions/src') / filename
    content = source.read_text()
    old = "{ region: 'us-central1', document:"
    assert content.count(old) == 1, filename
    source.write_text(content.replace(old, "{ region: 'northamerica-south1', document:"))
    old_export = f'exports.{name} ='
    assert text.count(old_export) == 1, name
    text = text.replace(old_export, f'exports.{name}RegionMigration =')
index.write_text(text)
PY
git diff --check
git diff -- functions
git add functions
git commit -m "chore: stage temporary Mexico Firestore subscriptions"
STAGE_A=$(git rev-parse HEAD)
firebase deploy --project "$PROJECT_ID" --only functions:onBookingCreateRegionMigration,functions:onBookingCreateTotalPassRegionMigration,functions:onBookingDeleteRegionMigration,functions:onUserUnlockNotificationRegionMigration
```

Abort any unexpected deletion prompt. Do not use `--force`, a full deploy, or `npm run deploy`.
The explicit alias selectors leave the old functions deployed even though the stage source exports only the aliases.
Keep this stage source and `STAGE_A` for recovery. There should now be 21 live functions: the original 17 plus four temporary Mexico functions.

Use this read-only verification helper for each new receiver. Confirm active compute and trigger in Mexico, Node.js 22, matching filters and intended identities.

```bash
inspect_receiver() {
  local name=$1 region=$2 trigger service
  gcloud functions describe "$name" --gen2 --region="$region" --project="$PROJECT_ID" --format=json
  trigger=$(gcloud functions describe "$name" --gen2 --region="$region" --project="$PROJECT_ID" --format='value(eventTrigger.trigger)')
  gcloud eventarc triggers describe "${trigger##*/}" --location="$NEW_REGION" --project="$PROJECT_ID" --format=json
  service=$(gcloud functions describe "$name" --gen2 --region="$region" --project="$PROJECT_ID" --format='value(serviceConfig.service)')
  gcloud run services get-iam-policy "${service##*/}" --region="$region" --project="$PROJECT_ID" --format=json
}
for name in "${FUNCTIONS[@]}"; do
  inspect_receiver "${name}RegionMigration" "$NEW_REGION"
done
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --project="$PROJECT_ID" --freshness=1h --limit=100 --format=json
```

Watch passive production traffic and correlate operation IDs with the old functions. Perform active behavioral probes only in the separate rehearsal project.
Verify deduplication across old/new subscriptions, correct single logical reminder schedules, stable TotalPass delay, one vacancy allocation, and recoverable notification records.
Absence of errors or an `ACTIVE` status alone is insufficient; unlock events may require a longer observation window.

## 4. Gate and remove old Iowa subscriptions

Do not proceed until all four temporary functions pass acceptance criteria and old in-flight deliveries are accounted for.
Pause if a function has no representative traffic, IAM failures, missing effects, unexpected duplicates, or pending deliveries that cannot be reconciled.
If capture continues during drain, use the rehearsed cutover watermark and shared durable ledger to prove every operation at/before that watermark completed.
Account for events arriving after the watermark via the verified Mexico subscriptions. Retain old resources if this cannot be proven.

Only an authorized operator may run these deletions after reviewing each region and the saved configuration:

```bash
for name in "${FUNCTIONS[@]}"; do
  firebase functions:delete "$name" --region "$OLD_REGION" --project "$PROJECT_ID"
done
```

Delete only the four specified Firestore functions. Never omit `--region`.
Do not delete callables, task handlers, schedules, queues, or unrelated Eventarc/Pub/Sub resources manually.
Verify only the four old regional resources disappeared and Mexico aliases continue receiving all matching traffic.

## 5. Stage B: restore final names in Mexico

The aliases remain deployed while the original names are created in Mexico.

```bash
python3 - <<'PY'
from pathlib import Path
index = Path('functions/index.js')
text = index.read_text()
for name in ['onBookingCreate', 'onBookingCreateTotalPass', 'onBookingDelete', 'onUserUnlockNotification']:
    alias = f'exports.{name}RegionMigration ='
    assert text.count(alias) == 1, name
    text = text.replace(alias, f'exports.{name} =')
index.write_text(text)
PY
npm test
node scripts/discover-function-endpoints.cjs functions > /tmp/region-final.json
git diff --check
git diff -- functions
git add functions
git commit -m "chore: restore final Firestore names in Mexico"
firebase deploy --project "$PROJECT_ID" --only functions:onBookingCreate,functions:onBookingCreateTotalPass,functions:onBookingDelete,functions:onUserUnlockNotification
```

Before deployment, compare `/tmp/region-final.json` to the safe baseline: only four endpoint `region` arrays may change to `northamerica-south1`.
All names, filters, schedules, task limits, retries, identities, resource settings, required APIs, and the other 13 endpoints must match.
The discovery script's optional baseline argument asserts **zero** changes; use it for this documentation PR, not to accept the four intentional future region differences.
Separately verify actual trigger location in deployed metadata; SDK discovery cannot resolve it from the cloud.

Repeat the full acceptance and drain gate for aliases versus final Mexico functions.
Run `for name in "${FUNCTIONS[@]}"; do inspect_receiver "$name" "$NEW_REGION"; done` and recheck error logs with the command above.
Only then remove temporary functions explicitly:

```bash
for name in "${FUNCTIONS[@]}"; do
  firebase functions:delete "${name}RegionMigration" --region "$NEW_REGION" --project "$PROJECT_ID"
done
firebase functions:list --project "$PROJECT_ID" --json > /tmp/functions-after.json
```

Verify exactly 17 live functions: original four names in Mexico, other 13 in Iowa, no migration aliases or old copies.
Recheck queues/targets, scheduler jobs/timezones, callable clients, trigger health, IAM, operation reconciliation, and error/latency metrics.
Retain the durable deduplication/recovery logic and its retention horizon after migration. Keep access-controlled evidence and source SHAs for rollback.
Commit the final 17-export source through the normal review workflow before allowing routine full deployments again.

## Rollback

Before deleting any Iowa functions, restore source from `SAFE_BASE`; keep the old functions running.
After verifying old health and accounting for pending alias deliveries, delete only `*RegionMigration` in Mexico using the loop in step 5.
If some Stage A deployments fail, remove only aliases actually created, after the same verification. Never delete the healthy old receiver first.

After Iowa deletion, keep at least one verified Mexico receiver for every event type. If aliases were removed, restore Stage A source and deploy the four alias selectors from step 3 first.
Do not replace healthy receivers with a pre-idempotency version.
If final Mexico functions exist, verify/drain them against the active aliases, then delete their names with `--region "$NEW_REGION"` using the step 4 loop with that region.
Recreate original Iowa functions from the safe baseline while Mexico aliases stay active:

```bash
git restore --source="$SAFE_BASE" -- functions
firebase deploy --project "$PROJECT_ID" --only functions:onBookingCreate,functions:onBookingCreateTotalPass,functions:onBookingDelete,functions:onUserUnlockNotification
```

Verify Iowa originals, matching filters/identities, representative traffic and operation reconciliation; drain aliases before using step 5's alias deletion loop.
Restore the safe baseline as the branch's final committed source so a later deployment cannot reintroduce Mexico accidentally.
If no healthy receiver remains, declare an incident, restore a verified receiver, and reconcile from retained event/operation evidence.
New subscriptions do not replay gaps. Some deleted-booking or unlock events may be unrecoverable without prior durable capture.
Rollback does not reverse sent pushes, tasks, notification logs, or waitlist changes; only the owner may authorize any required data repair.
