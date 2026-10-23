import { createChallenge, verifyChallenge } from '../../lib/auth.mjs'

export default async function handler(request, response) {
  const segments = Array.isArray(request.query.path) ? request.query.path : [request.query.path]
  const pathname = `/${segments.filter(Boolean).join('/')}`
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
