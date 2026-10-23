import crypto from 'node:crypto'
import { requireSession } from './auth.mjs'

const base = 'https://api.strikefinance.org'

function signedHeaders(method, pathname, body = '') {
  const publicKey = process.env.STRIKE_API_WALLET_PUBLIC_KEY?.trim().toLowerCase().replace(/^0x/, '')
  const privateKey = process.env.STRIKE_API_WALLET_PRIVATE_KEY?.trim().toLowerCase().replace(/^0x/, '')
  if (!publicKey || !privateKey) throw new Error('Strike API wallet credentials are not configured')
  const seed = Buffer.from(privateKey.slice(0, 64), 'hex')
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  const key = crypto.createPrivateKey({ key: Buffer.concat([prefix, seed]), format: 'der', type: 'pkcs8' })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
  const message = `${method.toUpperCase()}:${pathname}:${timestamp}:${nonce}:${bodyHash}`
  return { 'X-API-Wallet-Public-Key': publicKey, 'X-API-Wallet-Signature': crypto.sign(null, Buffer.from(message), key).toString('hex'), 'X-API-Wallet-Timestamp': timestamp, 'X-API-Wallet-Nonce': nonce, 'User-Agent': 'Ospaz/1.0 Ospaz trading adapter' }
}

export async function publicStrike(pathname, query, response) {
  const target = new URL(pathname, base)
  Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined) target.searchParams.set(key, String(value)) })
  const upstream = await fetch(target, { headers: { 'User-Agent': 'Ospaz/1.0 Vercel public monitor' } })
  response.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(await upstream.text())
}

export async function privateStrike(pathname, request, response) {
  const sessionAddress = requireSession(request)
  const accountResponse = await fetch(new URL('/v2/account', base), { headers: signedHeaders('GET', '/v2/account') })
  if (!accountResponse.ok) throw new Error(`Strike authenticated API returned ${accountResponse.status}`)
  const account = await accountResponse.json()
  if (String(account.blockchain_address || '').toLowerCase() !== sessionAddress.toLowerCase()) throw new Error('Connected wallet does not match the Strike account')
  const upstream = await fetch(new URL(pathname, base), { headers: signedHeaders('GET', pathname) })
  response.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json').send(await upstream.text())
}

export async function liveStrikeOrder(body, request) {
  const sessionAddress = requireSession(request)
  const accountResponse = await fetch(new URL('/v2/account', base), { headers: signedHeaders('GET', '/v2/account') })
  if (!accountResponse.ok) throw new Error(`Strike authenticated API returned ${accountResponse.status}`)
  const account = await accountResponse.json()
  if (String(account.blockchain_address || '').toLowerCase() !== sessionAddress.toLowerCase()) throw new Error('Connected wallet does not match the Strike account')
  const bodyText = JSON.stringify(body)
  const upstream = await fetch(new URL('/v2/order', base), { method: 'POST', headers: { ...signedHeaders('POST', '/v2/order', bodyText), 'Content-Type': 'application/json' }, body: bodyText })
  return { status: upstream.status, payload: await upstream.json() }
}
