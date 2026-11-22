import { connectDB, disconnectDB } from '../config/db.js';
import { ensureBaseSetup } from './seed.js';

async function main() {
  try {
    await connectDB();
    await ensureBaseSetup({ forceSeedFleet: true });
    console.log('[Seed] Colombo Tours initial admin, settings, categories, services, and fleet verified.');
  } catch (error) {
    console.error('[Seed] Failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
