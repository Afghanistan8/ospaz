import crypto from 'node:crypto'
import { createChallenge, requireSession, verifyChallenge } from '../../lib/auth.mjs'

const STRIKE_BASE = 'https://api.strikefinance.org'
const publicPaths = new Set(['/v2/vaults', '/stat/v1/stats/leaderboard', '/price/v2/markPrice'])
const authenticatedPaths = new Set(['/v2/account', '/v2/positions'])

function signedHeaders(pathname) {
  const publicKey = process.env.STRIKE_API_WALLET_PUBLIC_KEY?.trim().toLowerCase().replace(/^0x/, '')
  const privateKey = process.env.STRIKE_API_WALLET_PRIVATE_KEY?.trim().toLowerCase().replace(/^0x/, '')
  if (!publicKey || !privateKey) throw new Error('Strike API wallet credentials are not configured')
  if (!/^[0-9a-f]{64}$/.test(publicKey) || !/^[0-9a-f]{64}$|^[0-9a-f]{128}$/.test(privateKey)) throw new Error('Invalid Strike API wallet key format')
  const seed = Buffer.from(privateKey.slice(0, 64), 'hex')
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  const key = crypto.createPrivateKey({ key: Buffer.concat([prefix, seed]), format: 'der', type: 'pkcs8' })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update('').digest('hex')
  const message = `GET:${pathname}:${timestamp}:${nonce}:${bodyHash}`
  return { 'X-API-Wallet-Public-Key': publicKey, 'X-API-Wallet-Signature': crypto.sign(null, Buffer.from(message), key).toString('hex'), 'X-API-Wallet-Timestamp': timestamp, 'X-API-Wallet-Nonce': nonce, 'User-Agent': 'Ospaz/1.0 Vercel read-only monitor' }
}

export default async function handler(request, response) {
  const segments = Array.isArray(request.query.path) ? request.query.path : [request.query.path]
  const pathname = `/${segments.filter(Boolean).join('/')}`
  if (pathname === '/auth/nonce' && request.method === 'POST') {
    try { const challenge = createChallenge(request.body?.address, request); response.setHeader('Set-Cookie', challenge.cookie); return response.status(200).json({ message: challenge.message }) }
    catch (error) { return response.status(400).json({ error: error.message }) }
  }
  if (pathname === '/auth/verify' && request.method === 'POST') {
    try { const session = verifyChallenge(request, request.body?.address, request.body?.message, request.body?.signature); response.setHeader('Set-Cookie', session.cookie); return response.status(200).json({ address: session.address }) }
    catch (error) { return response.status(401).json({ error: error.message }) }
  }
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const isPublic = publicPaths.has(pathname)
  const isAuthenticated = authenticatedPaths.has(pathname)
  if (!isPublic && !isAuthenticated) return response.status(404).json({ error: 'Strike route not available' })
  if (isAuthenticated) {
    try { requireSession(request) } catch (error) { return response.status(401).json({ error: error.message }) }
  }
  const target = new URL(pathname, STRIKE_BASE)
  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'path') continue
    if (Array.isArray(value)) value.forEach((entry) => target.searchParams.append(key, String(entry)))
    else if (value !== undefined) target.searchParams.set(key, String(value))
  }
  try {
    const upstream = await fetch(target, { headers: isAuthenticated ? signedHeaders(`${pathname}${target.search}`) : { 'User-Agent': 'Ospaz/1.0 Vercel public monitor' } })
    response.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(await upstream.text())
  } catch (error) { response.status(502).json({ error: error instanceof Error ? error.message : 'Strike API unavailable' }) }
}
