import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createChallenge, requireSession, verifyChallenge } from './lib/auth.mjs'

const app = express()
app.use(express.json({ limit: '20kb' }))
const root = path.dirname(fileURLToPath(import.meta.url))
const strike = 'https://api.strikefinance.org'
const allowedSymbols = new Set(['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD'])

function loadLocalEnv() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadLocalEnv()

function getSigningKey() {
  const publicKey = process.env.STRIKE_API_WALLET_PUBLIC_KEY?.trim().toLowerCase().replace(/^0x/, '')
  const privateKey = process.env.STRIKE_API_WALLET_PRIVATE_KEY?.trim().toLowerCase().replace(/^0x/, '')
  if (!publicKey || !privateKey) throw new Error('Strike API wallet credentials are not configured')
  if (!/^[0-9a-f]{64}$/.test(publicKey)) throw new Error('Strike public key must be 64 hexadecimal characters')
  if (!/^[0-9a-f]{64}$|^[0-9a-f]{128}$/.test(privateKey)) throw new Error('Strike private key must be 64 or 128 hexadecimal characters')
  const seed = Buffer.from(privateKey.slice(0, 64), 'hex')
  const derPrefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  return { publicKey, key: crypto.createPrivateKey({ key: Buffer.concat([derPrefix, seed]), format: 'der', type: 'pkcs8' }) }
}

async function strikeAuthenticatedGet(pathname) {
  const { publicKey, key } = getSigningKey()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update('').digest('hex')
  const message = `GET:${pathname}:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.sign(null, Buffer.from(message), key).toString('hex')
  const response = await fetch(new URL(pathname, strike), {
    headers: {
      'X-API-Wallet-Public-Key': publicKey,
      'X-API-Wallet-Signature': signature,
      'X-API-Wallet-Timestamp': timestamp,
      'X-API-Wallet-Nonce': nonce,
      'User-Agent': 'Ospaz/1.0 authenticated read-only monitor',
    },
  })
  const payload = await response.text()
  if (!response.ok) throw new Error(`Strike authenticated API returned ${response.status}: ${payload.slice(0, 240)}`)
  return JSON.parse(payload)
}

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

app.get('/api/strike/account', async (_request, response) => {
  try { requireSession(_request); response.json(await strikeAuthenticatedGet('/v2/account')) }
  catch (error) { response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message }) }
})

app.get('/api/strike/positions', async (request, response) => {
  const symbol = request.query.symbol ? String(request.query.symbol).toUpperCase() : ''
  if (symbol && !allowedSymbols.has(symbol)) return response.status(400).json({ error: 'Unsupported symbol' })
  const pathname = symbol ? `/v2/positions?symbol=${encodeURIComponent(symbol)}` : '/v2/positions'
  try { requireSession(request); response.json(await strikeAuthenticatedGet(pathname)) }
  catch (error) { response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message }) }
})

app.post('/api/auth/nonce', (request, response) => {
  try {
    const challenge = createChallenge(request.body?.address, request)
    response.setHeader('Set-Cookie', challenge.cookie)
    response.json({ message: challenge.message })
  } catch (error) { response.status(400).json({ error: error.message }) }
})

app.post('/api/auth/verify', (request, response) => {
  try {
    const session = verifyChallenge(request, request.body?.address, request.body?.message, request.body?.signature)
    response.setHeader('Set-Cookie', session.cookie)
    response.json({ address: session.address })
  } catch (error) { response.status(401).json({ error: error.message }) }
})

app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))
app.listen(process.env.PORT || 4173, () => console.log('Ospaz running on port 4173'))
