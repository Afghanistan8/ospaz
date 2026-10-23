import { publicStrike } from '../../lib/strike-api.mjs'
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  try { return await publicStrike('/stat/v1/stats/leaderboard', { time_range: '30d', platform: 'strike', limit: 20, sort_by: 'win_rate_pct', sort_dir: 'desc' }, response) } catch (error) { return response.status(502).json({ error: error.message }) }
}
