export type MarkPrice = { p: string; i: string; r: string; T: number; s: string }
export type Vault = { vault_id: string; name: string; status: string; is_verified: boolean; equity: string; period_return: string; sharpe_ratio: string | null; depositors: number; type: string }
export type Leader = { account_id: string; nickname: string; ada_handle: string; win_rate_pct: string; max_drawdown_pct: string; total_trades: number; roi: string; sharpe_ratio: string | null }
export type StrikeAccount = { account_id: string; blockchain: string; blockchain_address: string; nickname: string; wallet_balance: string; available_balance: string; copy_reserved_balance?: string; copy_deployed_margin?: string }
export type StrikePosition = { symbol: string; side?: string; size: string; entry_price?: string; mark_price?: string; unrealized_pnl?: string; liquidation_price?: string; leverage?: string }

async function read<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Live data is unavailable (${response.status})`)
  return response.json() as Promise<T>
}

export const loadVaults = async () => (await read<{ vaults: Vault[] }>('/api/strike/vaults')).vaults
export const loadLeaders = async () => (await read<{ entries: Leader[] }>('/api/strike/leaderboard')).entries
export const loadMarkPrice = () => read<MarkPrice>('/api/strike/mark-price?symbol=BTC-USD')
export const loadAccount = () => read<StrikeAccount>('/api/strike/account')
export const loadPositions = () => read<{ count: number; positions: StrikePosition[] }>('/api/strike/positions')

export function openMarkPriceStream(onPrice: (price: MarkPrice) => void, onError: () => void) {
  const socket = new WebSocket('wss://api.strikefinance.org/ws/price')
  socket.onopen = () => socket.send(JSON.stringify({ method: 'subscribe', channel: 'markprice', symbol: 'BTC-USD', id: 1 }))
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data)) as MarkPrice
      if (data.s === 'BTC-USD' && data.p) onPrice(data)
    } catch { onError() }
  }
  socket.onerror = onError
  return () => socket.close()
}
