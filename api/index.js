import { app } from '../server/src/app.js';
import { assertCriticalEnv } from '../server/src/config/env.js';

export default async function handler(req, res) {
  try {
    assertCriticalEnv();
  } catch (error) {
    console.error('[Vercel API] Configuration error:', error.message);
    return res.status(500).json({ error: 'Server environment is not configured.' });
  }
  return app(req, res);
}
