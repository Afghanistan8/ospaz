import { publicStrike } from '../../lib/strike-api.mjs'
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const symbol = String(request.query.symbol || 'BTC-USD').toUpperCase()
  if (!['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD'].includes(symbol)) return response.status(400).json({ error: 'Unsupported symbol' })
  try { return await publicStrike('/price/v2/markPrice', { symbol }, response) } catch (error) { return response.status(502).json({ error: error.message }) }
}
