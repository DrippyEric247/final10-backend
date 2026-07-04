const mongoose = require('mongoose');
const { logProcessCrash } = require('../services/structuredLog');
const { auditMongoConnect, auditMongoFailure } = require('../services/auditLogger');
const { logStartupSuccess } = require('./startupBanner');

const MONGOOSE_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib'],
  zlibCompressionLevel: 6,
};

const MAX_MONGO_ATTEMPTS = 12;
const RETRY_BASE_MS = 5000;

let mongoBootAttempt = 0;
let mongoConnectPromise = null;
let postConnectHookRan = false;

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function startMongoConnection({ uri, port, onConnected }) {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';

  if (mongoConnectPromise) {
    return mongoConnectPromise;
  }

  mongoConnectPromise = new Promise((resolve) => {
    const attemptConnect = () => {
      mongoBootAttempt += 1;
      console.log(`[startup] MongoDB connect attempt ${mongoBootAttempt}/${MAX_MONGO_ATTEMPTS}`);

      mongoose
        .connect(mongoUri, MONGOOSE_OPTIONS)
        .then(async () => {
          console.log('✅ Connected to MongoDB with production optimizations');
          auditMongoConnect({
            host: mongoose.connection.host,
            name: mongoose.connection.name,
            readyState: mongoose.connection.readyState,
          });
          logStartupSuccess({ port, mongoReady: true, phase: 'mongo_connected' });
          if (!postConnectHookRan && typeof onConnected === 'function') {
            postConnectHookRan = true;
            await onConnected();
          }
          resolve(true);
        })
        .catch((error) => {
          auditMongoFailure({ message: error?.message, code: error?.code });
          logProcessCrash('MONGO_CONNECT_FAILURE', error);
          console.error(
            `[startup] MongoDB connection failed (attempt ${mongoBootAttempt}):`,
            error?.message || error
          );

          if (mongoBootAttempt >= MAX_MONGO_ATTEMPTS) {
            console.error(
              '[startup] MongoDB still unavailable after retries — HTTP server stays up; DB routes will fail until Mongo is reachable.'
            );
            resolve(false);
            return;
          }

          const delay = Math.min(30000, RETRY_BASE_MS * mongoBootAttempt);
          console.log(`[startup] MongoDB retry in ${delay}ms`);
          setTimeout(attemptConnect, delay);
        });
    };

    attemptConnect();
  });

  return mongoConnectPromise;
}

module.exports = {
  MONGOOSE_OPTIONS,
  isMongoReady,
  startMongoConnection,
};
