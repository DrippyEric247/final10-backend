const { info, warn } = require('../services/structuredLog');

function readHeapMb() {
  const mu = process.memoryUsage();
  return {
    heapUsedMb: Math.round((mu.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((mu.heapTotal / 1024 / 1024) * 10) / 10,
    rssMb: Math.round((mu.rss / 1024 / 1024) * 10) / 10,
  };
}

function logMemoryUsage(event, meta = {}) {
  const heap = readHeapMb();
  const row = { event, ...heap, ...meta };
  if (heap.heapUsedMb > 380) {
    warn('MEMORY_USAGE_HIGH', row);
  } else {
    info('MEMORY_USAGE', row);
  }
  return heap;
}

module.exports = { readHeapMb, logMemoryUsage };
