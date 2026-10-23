import { getDailyLoss } from '../../lib/risk-ledger.mjs'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const limit = Number(process.env.OSPAZ_DAILY_LOSS_LIMIT)
  if (!Number.isFinite(limit) || limit <= 0) return response.status(503).json({ error: 'Durable daily-loss limit is not configured' })
  try {
    const ledger = await getDailyLoss(request)
    return response.json({ ...ledger, limit, remaining: Math.max(0, limit - ledger.loss), live_enabled: process.env.OSPAZ_LIVE_TRADING_ENABLED === 'true' })
  } catch (error) {
    return response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message })
  }
}
