import { handleOptions, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import { useUp } from './handler.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    await requireUser(req);
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
  return useUp.fetch(req);
});
