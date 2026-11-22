import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Cache MongoDB connection across warm Vercel serverless invocations.
 * Prevents connection churn and respects MongoDB Atlas connection limits.
 */
const globalCache = globalThis.__colomboToursMongo || {
  conn: null,
  promise: null,
  memoryServer: null,
};
globalThis.__colomboToursMongo = globalCache;

/**
 * Serverless-tuned MongoDB Atlas pool options:
 * - maxPoolSize: 5 — keeps per-instance pool compact for Vercel Fluid Compute + Atlas M0/Flex limits.
 * - minPoolSize: 0 — avoids keeping idle sockets open when serverless instances scale down.
 * - maxIdleTimeMS: 20000 — promptly releases idle connections back to Atlas.
 * - connectTimeoutMS: 10000 — accommodates cross-region Atlas SRV + TLS handshakes.
 * - socketTimeoutMS: 30000 — prevents hung operations from stalling function execution.
 * - serverSelectionTimeoutMS: 8000 — fails fast with an actionable error if Atlas URI/IP access fails.
 */
const SERVERLESS_MONGO_OPTIONS = {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 20000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 8000,
};

export async function connectDB(overrideUri) {
  if (globalCache.conn && mongoose.connection.readyState === 1) {
    return globalCache.conn;
  }

  if (!globalCache.promise) {
    globalCache.promise = (async () => {
      let uri = overrideUri || env.mongodbUri;

      if (!uri) {
        if (env.useInMemoryDb) {
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          globalCache.memoryServer = await MongoMemoryServer.create();
          uri = globalCache.memoryServer.getUri();
          console.info('[DB] Started local in-memory MongoDB preview instance.');
        } else {
          throw new Error(
            'MONGODB_URI is not configured. Set MONGODB_URI in .env (or USE_IN_MEMORY_DB=true for local preview).'
          );
        }
      }

      // On some Windows setups Node's c-ares resolver defaults to loopback (127.0.0.1),
      // causing querySrv ECONNREFUSED on mongodb+srv:// URIs during local development.
      if (
        !env.isProduction &&
        uri.startsWith('mongodb+srv://') &&
        dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')
      ) {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
      }

      mongoose.set('strictQuery', true);
      const connection = await mongoose.connect(uri, SERVERLESS_MONGO_OPTIONS);
      return connection;
    })();
  }

  try {
    globalCache.conn = await globalCache.promise;
    return globalCache.conn;
  } catch (error) {
    globalCache.promise = null;
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (globalCache.memoryServer) {
    await globalCache.memoryServer.stop();
    globalCache.memoryServer = null;
  }
  globalCache.conn = null;
  globalCache.promise = null;
}
