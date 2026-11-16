import type { Express, Request, Response } from 'express';
import { getPlanBoostDb } from '../plan-boost-db';
import { getOwnerBoostState } from './boostService';

type ResolveUserId = (req: Request) => Promise<string | null>;

export function registerBoostRoutes(app: Express, resolveUserId: ResolveUserId) {
  app.get('/api/boosts/job/:jobId', async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    try {
      res.json(await getOwnerBoostState(getPlanBoostDb(), req.params.jobId, userId));
    } catch (error) {
      console.error('[boost state]', error);
      res.status(500).json({ error: 'boost_state_failed' });
    }
  });
}
