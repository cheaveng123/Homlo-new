import { Router } from 'express';
import type { Pool } from 'pg';
import { getOwnerBoostState } from './03_boostService';

// Mount with: app.use('/api/boosts', boostRoutes(pool, requireAuth))
// requireAuth must set req.user.id (use whatever the existing routes use).
export function boostRoutes(db: Pool, requireAuth: any) {
  const r = Router();

  r.get('/job/:jobId', requireAuth, async (req: any, res) => {
    try { res.json(await getOwnerBoostState(db, req.params.jobId, req.user.id)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'boost_state_failed' }); }
  });

  return r;
}
