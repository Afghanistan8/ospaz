import { liveStrikeRequest } from '../../lib/strike-api.mjs'

export default async function handler(request, response) {
  if (request.method !== 'DELETE') return response.status(405).json({ error: 'Method not allowed' })
  if (process.env.OSPAZ_EMERGENCY_CANCEL_ENABLED !== 'true') return response.status(503).json({ error: 'Emergency cancellation is not enabled' })
  const body = typeof request.body === 'string' ? (() => { try { return JSON.parse(request.body) } catch { return null } })() : request.body
  if (!body || body.confirm !== true || body.confirmation_phrase !== 'EMERGENCY CANCEL ALL BTC-USD ORDERS') return response.status(400).json({ error: 'Exact emergency cancellation confirmation is required' })
  try {
    const result = await liveStrikeRequest('DELETE', '/v2/order/cancel-all', { symbol: 'BTC-USD' }, request)
    return response.status(result.status).json({ ...result.payload, ospaz: { mode: 'emergency-cancel', symbol: 'BTC-USD' } })
  } catch (error) {
    return response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message })
  }
}
