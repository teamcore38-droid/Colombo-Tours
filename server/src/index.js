import { app } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { assertCriticalEnv, env } from './config/env.js';
import { ensureBootstrapped } from './utils/seed.js';

async function start() {
  try {
    assertCriticalEnv();
    await connectDB();
    await ensureBootstrapped();

    const server = app.listen(env.port, () => {
      console.log(
        `[Colombo Tours API] Listening on http://localhost:${env.port}`
      );
    });

    const shutdown = async (signal) => {
      console.log(`[Colombo Tours API] Received ${signal}, shutting down...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      console.error('[Colombo Tours API] Unhandled rejection:', reason);
    });
  } catch (error) {
    console.error('[Colombo Tours API] Startup error:', error);
    process.exit(1);
  }
}

start();
