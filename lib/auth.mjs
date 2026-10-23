import crypto from 'node:crypto'
import { verifyMessage } from 'ethers'

const challengeCookie = 'ospaz_challenge'
const sessionCookie = 'ospaz_session'
const ttlSeconds = 300

function secret() {
  const value = process.env.OSPAZ_AUTH_SECRET?.trim()
  if (!value) throw new Error('OSPAZ_AUTH_SECRET is not configured')
  return value
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url')
}

function pack(value) {
  return `${Buffer.from(value).toString('base64url')}.${sign(value)}`
}

function unpack(token) {
  const [encoded, signature] = String(token || '').split('.')
  if (!encoded || !signature) return null
  const value = Buffer.from(encoded, 'base64url').toString('utf8')
  const expected = sign(value)
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return value
}

export function cookieHeader(name, value, request) {
  const secure = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https'
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secure ? '; Secure' : ''}`
}

export function createChallenge(address, request) {
  const normalized = String(address).toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error('Invalid wallet address')
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const nonce = crypto.randomBytes(24).toString('hex')
  const message = `Sign in to Ospaz\n\nWallet: ${normalized}\nNonce: ${nonce}\nExpires: ${expires}`
  const token = pack(`${normalized}|${nonce}|${expires}`)
  return { message, cookie: cookieHeader(challengeCookie, token, request) }
}

export function verifyChallenge(request, address, message, signature) {
  const cookies = parseCookies(request.headers.cookie)
  const value = unpack(cookies[challengeCookie])
  if (!value) throw new Error('Login challenge expired or invalid')
  const [expectedAddress, nonce, expires] = value.split('|')
  if (Number(expires) < Math.floor(Date.now() / 1000)) throw new Error('Login challenge expired')
  const expectedMessage = `Sign in to Ospaz\n\nWallet: ${expectedAddress}\nNonce: ${nonce}\nExpires: ${expires}`
  if (message !== expectedMessage) throw new Error('Invalid login message')
  const recovered = verifyMessage(message, signature).toLowerCase()
  if (recovered !== expectedAddress || recovered !== String(address).toLowerCase()) throw new Error('Wallet signature does not match')
  const session = pack(`${recovered}|${Math.floor(Date.now() / 1000) + 86400}`)
  return { address: recovered, cookie: cookieHeader(sessionCookie, session, request) }
}

export function requireSession(request) {
  const cookies = parseCookies(request.headers.cookie)
  const value = unpack(cookies[sessionCookie])
  if (!value) throw new Error('Wallet authentication required')
  const [address, expires] = value.split('|')
  if (Number(expires) < Math.floor(Date.now() / 1000)) throw new Error('Wallet session expired')
  return address
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map((value) => decodeURIComponent(value))).filter(([key, value]) => key && value))
}
