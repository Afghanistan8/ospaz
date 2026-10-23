import { liveStrikeOrder } from '../../lib/strike-api.mjs'

const MIN_NOTIONAL = 10
const allowedTypes = new Set(['market', 'limit', 'stop', 'stop_limit', 'take_profit', 'take_profit_limit', 'trailing_stop_market'])

function fail(response, status, error) { return response.status(status).json({ error }) }

export default async function handler(request, response) {
  if (request.method !== 'POST') return fail(response, 405, 'Method not allowed')
  if (process.env.OSPAZ_LIVE_TRADING_ENABLED !== 'true') return fail(response, 503, 'Live trading is disabled. Ospaz remains paper-only until live risk controls are enabled.')

  let body
  try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body } catch { return fail(response, 400, 'Invalid JSON body') }
  if (!body || body.confirm !== true) return fail(response, 400, 'Explicit order confirmation is required')
  if (body.confirmation_phrase !== 'CONFIRM LIVE BTC-USD ORDER') return fail(response, 400, 'Confirmation phrase does not match')
  if (String(body.symbol).toUpperCase() !== 'BTC-USD') return fail(response, 400, 'Only BTC-USD is enabled for live trading')
  if (!['buy', 'sell'].includes(body.side) || !allowedTypes.has(body.type)) return fail(response, 400, 'Unsupported order side or type')
  if (body.reduce_only !== true) return fail(response, 400, 'Live orders must be reduce-only until an opening-order policy is explicitly enabled')

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) return fail(response, 400, 'Order size must be positive')
  const priceResponse = await fetch('https://api.strikefinance.org/price/v2/markPrice?symbol=BTC-USD')
  if (!priceResponse.ok) return fail(response, 502, 'Could not verify the live BTC-USD mark price')
  const priceData = await priceResponse.json()
  const markPrice = Number(priceData.p)
  if (!Number.isFinite(markPrice) || markPrice <= 0) return fail(response, 502, 'Live BTC-USD mark price is invalid')
  const notional = size * (body.type === 'limit' && Number(body.price) > 0 ? Number(body.price) : markPrice)
  const maxNotional = Number(process.env.OSPAZ_MAX_ORDER_NOTIONAL)
  if (!Number.isFinite(maxNotional) || maxNotional < MIN_NOTIONAL) return fail(response, 503, `Live risk cap must be configured to at least $${MIN_NOTIONAL} notional`)
  if (notional < MIN_NOTIONAL) return fail(response, 400, `BTC-USD minimum order notional is $${MIN_NOTIONAL}`)
  if (notional > maxNotional) return fail(response, 400, `Order exceeds the configured $${maxNotional} notional cap`)

  const order = { symbol: 'BTC-USD', side: body.side, type: body.type, size: String(body.size), reduce_only: true, client_order_id: String(body.client_order_id || `ospaz-${Date.now()}`) }
  for (const key of ['price', 'stop_price', 'time_in_force', 'working_type', 'price_protect', 'slippage']) if (body[key] !== undefined) order[key] = body[key]
  try {
    const result = await liveStrikeOrder(order, request)
    return response.status(result.status).json({ ...result.payload, ospaz: { mode: 'live', notional, mark_price: markPrice, client_order_id: order.client_order_id } })
  } catch (error) {
    return fail(response, error.message.includes('authentication') || error.message.includes('Wallet') ? 401 : 502, error.message)
  }
}
