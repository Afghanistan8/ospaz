import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const root = path.dirname(fileURLToPath(import.meta.url))
const strike = 'https://api.strikefinance.org'
const allowedSymbols = new Set(['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD'])

async function strikeGet(pathname, params = {}) {
  const url = new URL(pathname, strike)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, { headers: { 'User-Agent': 'Ospaz/1.0 read-only monitor' } })
  if (!response.ok) throw new Error(`Strike API returned ${response.status}`)
  return response.json()
}

app.get('/api/strike/vaults', async (_request, response) => {
  try { response.json(await strikeGet('/v2/vaults', { limit: 20, period: '30d' })) }
  catch (error) { response.status(502).json({ error: error.message }) }
})

app.get('/api/strike/leaderboard', async (_request, response) => {
  try { response.json(await strikeGet('/stat/v1/stats/leaderboard', { time_range: '30d', platform: 'strike', limit: 20, sort_by: 'win_rate_pct', sort_dir: 'desc' })) }
  catch (error) { response.status(502).json({ error: error.message }) }
})

app.get('/api/strike/mark-price', async (request, response) => {
  const symbol = String(request.query.symbol ?? 'BTC-USD').toUpperCase()
  if (!allowedSymbols.has(symbol)) return response.status(400).json({ error: 'Unsupported symbol' })
  try { response.json(await strikeGet('/price/v2/markPrice', { symbol })) }
  catch (error) { response.status(502).json({ error: error.message }) }
})

app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))
app.listen(process.env.PORT || 4173, () => console.log('Ospaz running on port 4173'))
