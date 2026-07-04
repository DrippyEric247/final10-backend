/**
 * Race a promise against a timeout — used for external OAuth/provider calls.
 */
function withAsyncTimeout(promise, ms, label = 'operation') {
  const timeoutMs = Math.max(1, Number(ms) || 1);
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = { withAsyncTimeout };
