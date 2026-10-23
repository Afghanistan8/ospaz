import { publicStrike } from '../../lib/strike-api.mjs'
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  try { return await publicStrike('/v2/vaults', { limit: 20, period: '30d' }, response) } catch (error) { return response.status(502).json({ error: error.message }) }
}
