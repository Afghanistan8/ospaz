import { privateStrike } from '../../lib/strike-api.mjs'
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const symbol = request.query.symbol ? String(request.query.symbol).toUpperCase() : ''
  if (symbol && !['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD'].includes(symbol)) return response.status(400).json({ error: 'Unsupported symbol' })
  try { return await privateStrike(symbol ? `/v2/positions?symbol=${encodeURIComponent(symbol)}` : '/v2/positions', request, response) } catch (error) { return response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message }) }
}
