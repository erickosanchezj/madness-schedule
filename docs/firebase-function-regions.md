<!-- docs/firebase-function-regions.md -->
<!-- Records the Firebase Functions region investigation and decision. -->
<!-- Prevents an unsafe region-only rollout while documenting the path to colocation. -->
<!-- RELEVANT FILES: functions/index.js, functions/src/waitlistNotifications.js, docs/firebase-function-region-migration.md, scripts/discover-function-endpoints.cjs -->

# Firebase Functions regional placement

Investigated November 2, 2026 (Mexico City), against main `fc66c0889f3aac6ec93ba60baf7a7c97a4507dd2`, including PR #251.

## Decision

**Keep the current regions for now. Keep this PR in draft until deployment facts and migration prerequisites are verified.**

Colocating the four Firestore handlers in `northamerica-south1` is a reasonable eventual target if the database location and Firebase deployment support are confirmed.
Do not make a region-only source edit today: concurrent subscriptions would repeat side effects, and deleting first could lose events.
The minimal implementation is this investigation, a [gated migration runbook](firebase-function-region-migration.md), and a local SDK discovery command.
No runtime code, export names, clients, dependencies, task destinations, or schedules change. The warning remains visible.

## Why deployment warns

All four source declarations explicitly select `us-central1` for compute. Their event filters select the default Firestore database.
The reported deployment resolves their trigger location to `northamerica-south1`.
Compute location and Eventarc trigger location are separate settings; successful deployment does not imply colocation.

The [Firebase CLI warning implementation](https://github.com/firebase/firebase-tools/blob/a1e419ca610458f057c2d72153a1e57a810fda1b/src/deploy/functions/triggerRegionHelper.ts) checks these locations after resolving the database location.
This explains the warning; it is not evidence that SDK 7.4.0 broke deployment, nor a reason to downgrade or suppress it.
The CLI source was inspected at the linked revision; the production deployment's CLI version is unknown.

## All 17 exports

Every export is second generation and explicitly uses `us-central1`. Source imports use `firebase-functions/v2` subpaths.

| Export | Trigger / dependency |
| --- | --- |
| `createBooking` | Callable; member client |
| `joinWaitlist` | Callable; member client |
| `leaveWaitlist` | Callable; member client |
| `cancelBooking` | Callable; member client; deletes reminder tasks |
| `sendDirectNotification` | Callable; admin client |
| `backfillEmailLower` | Callable; admin authorization; no in-repository client reference found |
| `resetAllStrikes` | Callable; admin client |
| `onBookingCreate` | Firestore create, `bookings/{bookingId}` |
| `onBookingCreateTotalPass` | Firestore create, `bookings/{bookingId}` |
| `onBookingDelete` | Firestore delete, `bookings/{bookingId}` |
| `onUserUnlockNotification` | Firestore update, `users/{userId}` |
| `sendBookingReminder` | Cloud Tasks; max concurrent dispatches 5 |
| `sendTotalPassReminder` | Cloud Tasks; max concurrent dispatches 5 |
| `onWaitlistExpiration` | Cloud Tasks; max concurrent dispatches 5 |
| `generateDailyClasses` | Scheduler, `0 16 * * 6` |
| `automaticWhitelisting` | Scheduler, `0 0 1 * *` |
| `resetMonthlySubscriptionStatuses` | Scheduler, `5 0 1 * *` |

All three schedules use `America/Mexico_City`. A timezone is not a compute region.
Both `index.html` and `admin.html` initialize callable clients in `us-central1`.
Reminder creation and cancellation use `projects/madnessscheds/locations/us-central1/functions/sendBookingReminder` and the equivalent `sendTotalPassReminder` path.
Waitlist processing targets `projects/madnessscheds/locations/us-central1/functions/onWaitlistExpiration`.
Moving only the four producers would not require moving those task handlers or editing these fully qualified targets.

## Regional support, latency, and cost

[Firebase location guidance](https://firebase.google.com/docs/functions/locations) recommends placing Firestore handlers near their database and warns about cross-location latency and billing.
Mexico colocation should remove a trigger-to-compute hop and shorten database round trips if the database is there. This is an inference, not a benchmark.
Reminder and waitlist producers would still call Iowa task queues. FCM delivery latency is not guaranteed to improve.

[Eventarc Standard](https://docs.cloud.google.com/eventarc/docs/locations) lists Mexico and requires the Firestore trigger to match the database location.
[Cloud Run locations](https://docs.cloud.google.com/run/docs/locations) lists Mexico and Iowa under Tier 1 pricing.
However, the Firebase Functions location table inspected does **not** list `northamerica-south1`.
Cloud Run availability alone does not establish Firebase CLI / Cloud Functions v2 API availability for Node.js 22 Firestore functions in this project.
Confirm that path with a separately authorized nonproduction deployment and the chosen CLI version before migrating production.

The second-generation cost model is [Cloud Run pricing](https://cloud.google.com/run/pricing).
Colocation may reduce cross-region transfer and billed execution time; duplicated invocations during overlap add compute, Firestore operations, tasks, pushes, and logs.
No traffic volumes, billing export, payload sizes, or latency measurements were available. No dollar savings are claimed.
Compare billed duration, regional network charges, Eventarc transport, Firestore reads/writes, and Cloud Tasks charges before and after an eventual rollout.

## Migration semantics and risks

The [second-generation Firebase migration instructions](https://firebase.google.com/docs/functions/manage-functions#modify_a_functions_name_region_or_trigger) use a renamed function in the new region, an overlap period, and explicit deletion of the old function.
They require idempotency first. We should use that staged procedure rather than assume an in-place move under the same exported name works.
Names can exist in different regions, but changing a region creates a new regional resource; it does not transfer its subscription or pending deliveries.
Temporary names are the documented approach, not a claim that same-named resources are universally prohibited.
The runbook adds a second handoff to restore the original four names, then removes temporary names.
This exact CLI/API sequence remains untested in this project.

[Firestore delivery guarantees](https://firebase.google.com/docs/functions/firestore-events#limitations) permit duplicates and out-of-order delivery.
Overlapping subscriptions deliberately increase duplicate execution. The installed SDK manifest sets `retry: false` on all four Firestore endpoints.
That does not guarantee exactly-once delivery and does not prove the deployed retry policy. Failed side effects may remain incomplete.

| Path inspected | Current protection and gap |
| --- | --- |
| Booking reminders | Checks booking existence; enqueues without stable task IDs; concurrent deliveries can create multiple reminder sets and overwrite `reminderTaskNames`. Admin booking pushes/logs repeat. A cancellation cannot reliably clean overwritten or unrecorded task IDs. |
| TotalPass enqueueing | Enqueues without stable IDs; each invocation chooses a fresh random delay. `totalPassTaskNames` can be overwritten; duplicates may arrive at different times. |
| Reminder task handlers | Check that a booking exists; do not deduplicate a delivery or distinguish all booking incarnations. Duplicate tasks/retries can send duplicate pushes and append duplicate logs. |
| Waitlist processing | Active-window check is a read, not a transactional claim. Parallel handlers can notify the same person; a later duplicate can skip that person and offer the next waiter the same vacancy. Hold writes, rebalancing, logging, and enqueueing are not atomic. Expiration processing shares these races. |
| Unlock alerts | Checks the event's before/after transition, not a durable event claim. Replaying that transition sends again. |
| Push and notification logs | `sendMulticast` sends each chunk without a deduplication key; `notifications.add()` generates a fresh document each time. Sending and logging are separate effects. Crashing between them can cause duplicate pushes or missing logs. Token pruning is not a delivery guard. |

Deleting the old subscription before a verified replacement creates a capture gap.
A new trigger does not backfill prior creates, deletes, or unlock transitions. Deleted bookings cannot be reconstructed just by querying current bookings.
Deleting a trigger with pending deliveries can lose them. Keeping it for an arbitrary number of minutes is not evidence of drain.
Rollback cannot unsend a push or automatically repair a changed waitlist hold.

Required follow-up: durable, region-independent operation keys and concurrency handling for all four paths and downstream task processing.
Keys must distinguish booking recreations and distinct unlock transitions, while matching between temporary and final exports.
Use stable task IDs and handle already-existing tasks; retain recoverable task references and a stable TotalPass delay.
Waitlist vacancy allocation needs an atomic claim, shared with expiration processing.
Use recoverable side-effect state / reconciliation; a one-time "processed" flag before sending can lose work after a crash, while setting it afterward can duplicate delivery.
FCM and Firestore do not provide a shared transaction. Define acceptable delivery semantics and recovery for ambiguous FCM outcomes rather than promise exactly-once pushes.
These are broader behavior/data changes and belong in a separately reviewed prerequisite, not this region investigation.

## IAM and unavailable deployment facts

No GCP outbound identity or credentials are configured in the managed environment; `gcloud` and Firebase CLI are not installed.
No cloud resources, production handlers, tasks, notifications, or production data were touched.
`madnessscheds` comes from `.firebaserc` and task paths. The warning and successful prior deployment are user-supplied evidence.
Database location/mode, live function configuration, trigger IDs/health, retry/retention settings, backlogs, service identities, IAM conditions, organization policy, quotas, and observed latency/cost remain unverified.

The [Eventarc IAM requirements](https://docs.cloud.google.com/eventarc/docs/roles-permissions) include a trigger identity with Event Receiver and invocation access on each new authenticated Cloud Run service.
The deployer needs permissions to create the resources and act as the selected identities. Preserve the inspected runtime and trigger service accounts; do not infer them from source defaults.
Check Eventarc and Cloud Functions service agents and any applicable legacy Pub/Sub token-creator requirement. Do not grant broad roles just to make deployment pass.
Runtime identities need the existing Firestore, FCM, and task permissions in the new location.
[Cloud Tasks guidance](https://firebase.google.com/docs/functions/task-functions#iam_permissions) covers enqueue permission and acting as the task identity; verify task invocation access, OIDC audience, and queue policies too.
The unchanged Iowa task services still need to accept requests from the actual producer identities.

## Validation

Node.js **22.23.3**: `npm test` passed all **8** existing tests.
Installed functions dependencies from the unchanged lockfile with `npm ci --ignore-scripts`: real `firebase-functions` **7.4.0**, `firebase-admin` **12.7.0** (declared range remains `^12.0.0`).
The SDK's actual `loadStack` and `stackToWire` discovered **17 gcfv2 endpoints**, without invoking a handler.
Compared the entire serialized manifest against an exact `origin/main` source archive using the same installed dependencies: **zero differences**, including regions, filters, retry settings, schedules, rate limits, and service-account settings.
Both snapshot SHA-256 values: `1dced4b082da64bc604e4f12dfe53c5accf51d29e75578de0c1fe2700ae7906e`.
Discovery uses internal SDK entry points and fails visibly if they change. Local discovery does not establish deployed IAM or regional availability.

```bash
# Run with Node.js 22 on PATH, from the repository root.
npm ci --prefix functions --ignore-scripts
npm test
mkdir -p /tmp/region-main
git archive origin/main functions | tar -x -C /tmp/region-main
ln -s "$PWD/functions/node_modules" /tmp/region-main/functions/node_modules
node scripts/discover-function-endpoints.cjs /tmp/region-main/functions > /tmp/region-main-endpoints.json
node scripts/discover-function-endpoints.cjs functions /tmp/region-main-endpoints.json > /tmp/region-final-endpoints.json
git diff --check
```

Ordinary Git fetch could not authenticate in this environment. Latest main was fetched through the connected GitHub API instead.
Its tree, blobs, and signed commit were restored locally and verified against their exact Git object hashes before investigation.
Publication uses the same GitHub connection. No unrelated dependency upgrade or refactoring is included.
