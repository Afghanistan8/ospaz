import { privateStrike } from '../../lib/strike-api.mjs'
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  try { return await privateStrike('/v2/account', request, response) } catch (error) { return response.status(error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502).json({ error: error.message }) }
}
