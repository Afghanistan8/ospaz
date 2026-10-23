import { liveStrikeRequest } from './strike-api.mjs'

// Strike's persisted transaction history is the durable source of truth. This
// avoids relying on ephemeral serverless memory for the daily-loss guard.
export async function getDailyLoss(request) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const path = `/v2/history/transaction?type=realized_pnl,fee,funding,liquidation&startTime=${start.getTime()}&limit=1000`
  const result = await liveStrikeRequest('GET', path, undefined, request)
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not read durable Strike transaction history (${result.status})`)
  const transactions = Array.isArray(result.payload?.transactions) ? result.payload.transactions : []
  const net = transactions.filter((entry) => ['completed', 'settled'].includes(entry.status)).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
  return { loss: Math.max(0, -net), start: start.toISOString(), transactionCount: transactions.length }
}
