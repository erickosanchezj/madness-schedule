// functions/lib/mapConcurrent.js
// Runs independent async operations with a small concurrency limit.
// Avoids serial network waits without flooding Firebase or leaving work running after errors.
// RELEVANT FILES: functions/lib/sendMulticast.js, functions/src/generateDailyClasses.js

async function mapConcurrent(items, callback, concurrency = 3) {
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await callback(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  // Drain in-flight operations before propagating a failure to the caller.
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  const rejected = workers.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return results;
}

module.exports = { mapConcurrent };
