import { createChallenge, verifyChallenge } from '../../lib/auth.mjs'

export default async function handler(request, response) {
  const requestPath = new URL(request.url, 'https://ospaz.local').pathname
  const querySegments = Array.isArray(request.query.path) ? request.query.path : [request.query.path]
  const pathname = requestPath.startsWith('/api/auth/') ? requestPath.slice('/api/auth'.length) : `/${querySegments.filter(Boolean).join('/')}`
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (pathname === '/nonce') {
    try {
      const challenge = createChallenge(request.body?.address, request)
      response.setHeader('Set-Cookie', challenge.cookie)
      return response.status(200).json({ message: challenge.message })
    } catch (error) { return response.status(400).json({ error: error.message }) }
  }
  if (pathname === '/verify') {
    try {
      const session = verifyChallenge(request, request.body?.address, request.body?.message, request.body?.signature)
      response.setHeader('Set-Cookie', session.cookie)
      return response.status(200).json({ address: session.address })
    } catch (error) { return response.status(401).json({ error: error.message }) }
  }
  return response.status(404).json({ error: 'Authentication route not found' })
}
