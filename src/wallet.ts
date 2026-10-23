export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

export type WalletOption = { id: string; name: string; provider: Eip1193Provider; detail: string }

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[]; isMetaMask?: boolean; isOKXWallet?: boolean }
    okxwallet?: { ethereum?: Eip1193Provider } | Eip1193Provider
  }
}

export function discoverWallets(): WalletOption[] {
  const wallets: WalletOption[] = []
  const seen = new Set<Eip1193Provider>()
  const add = (id: string, name: string, provider: Eip1193Provider | undefined, detail: string) => {
    if (!provider || seen.has(provider)) return
    seen.add(provider)
    wallets.push({ id, name, provider, detail })
  }

  const okx = window.okxwallet
  const okxProvider = okx && 'request' in okx ? okx as Eip1193Provider : okx?.ethereum
  add('okx', 'OKX Wallet', okxProvider, 'Browser extension')

  const injected = window.ethereum
  if (injected?.providers?.length) {
    injected.providers.forEach((provider, index) => {
      const candidate = provider as Eip1193Provider & { isOKXWallet?: boolean; isMetaMask?: boolean }
      if (provider === okxProvider || candidate.isOKXWallet) return
      add(candidate.isMetaMask ? 'metamask' : `injected-${index}`, candidate.isMetaMask ? 'MetaMask' : 'Browser wallet', candidate, 'Injected wallet')
    })
  }
  add('injected', injected?.isMetaMask ? 'MetaMask' : 'Browser wallet', injected, 'Injected wallet')
  return wallets
}

export async function connectWallet(provider: Eip1193Provider): Promise<string> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
  const address = accounts?.[0]
  if (!address) throw new Error('The wallet returned no account')
  return address
}
