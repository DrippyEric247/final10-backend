/**
 * Reject a MongoDB promise if it does not settle within `ms`.
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withMongoTimeout(promise, ms, label = 'query') {
  const timeoutMs = Math.max(1, Number(ms) || 5000);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = { withMongoTimeout };
