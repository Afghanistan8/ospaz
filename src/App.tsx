import { useEffect, useMemo, useState } from 'react'
import { loadAccount, loadLeaders, loadMarkPrice, loadPositions, loadVaults, openMarkPriceStream, type Leader, type MarkPrice, type StrikeAccount, type StrikePosition, type Vault } from './strike'
import { authenticateWallet, connectWallet, discoverWallets, type WalletOption } from './wallet'

type Plan = 'margin' | 'reduce' | 'stop'
type MonitorTab = 'bots' | 'vaults' | 'traders'
type PaperCopy = { id: string; trader: string; allocationPct: number; amount: number; createdAt: string; status: 'simulated' }

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const displayText = (value: string) => value.replace(/[\-–—]/g, ' ')
const displaySymbol = (value: string) => value.replace('-', ' / ')

type MonitorItem = { name: string; status: string; detail: string; metric: string; symbol?: string; tag?: string }

const percentWidth = (value: number, max = 100) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`

function SignalBar({ label, value, width, tone = '' }: { label: string; value: string; width: string; tone?: string }) {
  return <div className="signal-bar"><div><span>{label}</span><strong>{value}</strong></div><i className={tone} style={{ width }} /></div>
}

function VaultCard({ vault, maxEquity }: { vault: Vault; maxEquity: number }) {
  const active = vault.status === 'active'
  const verified = vault.is_verified
  const equity = Number(vault.equity) || 0
  const returnValue = Number(vault.period_return) || 0
  return <article className="data-card vault-card"><div className="data-card-head"><div><span className="card-index">VAULT</span><h4>{displayText(vault.name)}</h4></div><span className={`data-chip ${active && verified ? 'good' : 'caution'}`}>{active && verified ? 'Verified' : verified ? 'Review activity' : 'Unverified'}</span></div><div className="data-card-grid"><div className="data-fact"><span>Activity</span><strong className={active ? 'good-text' : 'muted-text'}>{active ? 'Active' : displayText(vault.status)}</strong></div><div className="data-fact"><span>30D return</span><strong>{returnValue.toFixed(2)}%</strong></div></div><SignalBar label="Equity" value={usd.format(equity)} width={percentWidth(equity, maxEquity)} /><SignalBar label="Return strength" value={`${returnValue.toFixed(2)}%`} width={percentWidth(Math.max(0, returnValue), 30)} tone={returnValue >= 0 ? 'positive-bar' : 'negative-bar'} /><div className="data-card-foot"><span>{vault.depositors} depositors</span><span>{vault.sharpe_ratio ? `Sharpe ${vault.sharpe_ratio}` : 'Sharpe unavailable'}</span></div></article>
}

function TraderCard({ leader, selected, onChoose }: { leader: Leader; selected: boolean; onChoose: () => void }) {
  const name = displayText(leader.nickname || leader.ada_handle || leader.account_id.slice(0, 8))
  const winRate = Number(leader.win_rate_pct) || 0
  const drawdown = Number(leader.max_drawdown_pct) || 0
  const roi = Number(leader.roi) || 0
  return <article className={`data-card trader-card ${selected ? 'selected-card' : ''}`}><div className="data-card-head"><div><span className="card-index">TRADER</span><h4>{name}</h4></div><strong className="headline-metric">{winRate.toFixed(1)}%<small>win rate</small></strong></div><div className="trader-chart"><div className="chart-column"><i style={{ height: percentWidth(winRate) }} /><span>Wins</span></div><div className="chart-column risk"><i style={{ height: percentWidth(drawdown, 50) }} /><span>Risk</span></div><div className="chart-column return"><i style={{ height: percentWidth(Math.max(0, roi), 100) }} /><span>ROI</span></div></div><div className="trader-facts"><span>{leader.total_trades} trades</span><span>{drawdown.toFixed(1)}% drawdown</span><span>{roi.toFixed(1)}% ROI</span></div><button className={`choose-trader ${selected ? 'chosen' : ''}`} onClick={onChoose}>{selected ? 'Selected for copy' : 'Choose trader'} <Icon name="arrow" /></button></article>
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    shield: 'M12 3 4.8 6v5.6c0 4.2 3.1 7.6 7.2 9.4 4.1-1.8 7.2-5.2 7.2-9.4V6L12 3Zm0 4.2 3.6 1.5v3c0 2.5-1.5 4.7-3.6 5.9-2.1-1.2-3.6-3.4-3.6-5.9v-3L12 7.2Z',
    bolt: 'M13.4 2.8 5.8 13h4.7L9.8 21.2 18.2 10h-4.8l.0-7.2Z',
    chart: 'M4 19V5m0 14h16M7 15l3.5-4 3 2.4L19 7',
    wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3H6.5a.5.5 0 0 0 0 1H20v8.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10ZM16 13h2',
    arrow: 'M5 12h13m-5-5 5 5-5 5',
    close: 'm7 7 10 10M17 7 7 17',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('ospaz-theme') === 'dark' ? 'dark' : 'light')
  const [markPrice, setMarkPrice] = useState<MarkPrice | null>(null)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [dataError, setDataError] = useState('')
  const [protectedPlan, setProtectedPlan] = useState<Plan | null>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [toast, setToast] = useState('')
  const [monitorTab, setMonitorTab] = useState<MonitorTab>('bots')
  const [lastScan, setLastScan] = useState('Connecting to Strike mainnet')
  const [account, setAccount] = useState<StrikeAccount | null>(null)
  const [positions, setPositions] = useState<StrikePosition[]>([])
  const [accountError, setAccountError] = useState('')
  const [selectedTrader, setSelectedTrader] = useState('')
  const [copyAllocation, setCopyAllocation] = useState('25')
  const [copyState, setCopyState] = useState('')
  const [paperCopy, setPaperCopy] = useState<PaperCopy | null>(null)
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([])
  const [showWalletPicker, setShowWalletPicker] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [nextVaults, nextLeaders, nextPrice] = await Promise.all([loadVaults(), loadLeaders(), loadMarkPrice()])
        if (!alive) return
        setVaults(nextVaults)
        setLeaders(nextLeaders)
        setMarkPrice(nextPrice)
        setLastScan('Live public data loaded')
      } catch (error) {
        if (alive) setDataError(error instanceof Error ? error.message : 'Live data is unavailable')
      }
    }
    void load()
    const closeStream = openMarkPriceStream((nextPrice) => { if (alive) setMarkPrice(nextPrice) }, () => { if (alive) setDataError('Live price stream disconnected; retrying public data.') })
    const refresh = window.setInterval(() => void load(), 60_000)
    return () => { alive = false; closeStream(); window.clearInterval(refresh) }
  }, [])

  useEffect(() => {
    let alive = true
    const loadPrivateData = async () => {
      try {
        const [nextAccount, nextPositions] = await Promise.all([loadAccount(), loadPositions()])
        if (!alive) return
        setAccount(nextAccount)
        setPositions(nextPositions.positions)
        setAccountError('')
      } catch (error) {
        if (alive) setAccountError(error instanceof Error ? error.message : 'Authenticated Strike data is unavailable')
      }
    }
    void loadPrivateData()
    const refresh = window.setInterval(() => void loadPrivateData(), 30_000)
    return () => { alive = false; window.clearInterval(refresh) }
  }, [])

  useEffect(() => {
    localStorage.setItem('ospaz-theme', theme)
  }, [theme])

  const price = Number(markPrice?.p ?? 0)
  const monitorData: Record<MonitorTab, MonitorItem[]> = useMemo(() => ({
    bots: [{ name: account ? `Strike account · ${displayText(account.nickname || account.account_id.slice(0, 8))}` : 'Your Strike account', status: account ? 'Connected and readable' : 'Account connection required', detail: account ? `${positions.length} open position${positions.length === 1 ? '' : 's'} · ${account.blockchain} · ${account.blockchain_address.slice(0, 6)}…${account.blockchain_address.slice(-4)} · balance ${usd.format(Number(account.wallet_balance) || 0)}` : accountError || 'Add a valid Strike API wallet to inspect your account and bot health.', metric: account ? 'Authenticated read only' : 'Read only access', tag: account ? 'Active' : 'Connect' }],
    vaults: vaults.slice(0, 3).map((vault) => ({ name: vault.name, status: vault.status === 'active' && vault.is_verified && Number(vault.equity) > 0 ? 'Operational signals present' : vault.status === 'active' ? 'Review before depositing' : 'Not accepting new capital', detail: `${vault.status} · ${vault.is_verified ? 'verified' : 'not verified'} · $${Number(vault.equity).toLocaleString()} equity · ${vault.sharpe_ratio ?? 'no'} Sharpe`, metric: `${Number(vault.period_return).toFixed(2)}% 30D return` })),
    traders: leaders.filter((leader) => leader.total_trades >= 10).slice(0, 3).map((leader) => ({ name: displayText(leader.nickname || leader.ada_handle || leader.account_id.slice(0, 8)), status: Number(leader.max_drawdown_pct) <= 15 ? 'Historical profile available' : 'High drawdown. Review risk.', detail: `${leader.total_trades} trades. ${Number(leader.max_drawdown_pct).toFixed(2)}% maximum drawdown. ROI ${Number(leader.roi).toFixed(2)}%. Historical performance is not a guarantee.`, metric: `${Number(leader.win_rate_pct).toFixed(1)}% win rate` })),
  }), [vaults, leaders, account, positions.length, accountError])

  const risk = protectedPlan ? 58 : 82
  const liquidationPrice = protectedPlan === 'margin' ? 60_130 : protectedPlan === 'reduce' ? 61_740 : protectedPlan === 'stop' ? 62_880 : 62_010
  const safety = useMemo(() => price ? Math.max(0, ((price - liquidationPrice) / price) * 100) : 0, [price, liquidationPrice])

  const protect = (plan: Plan) => {
    setProtectedPlan(plan)
    setShowPlan(false)
    setToast(plan === 'margin' ? 'Protection plan previewed. No margin was transferred.' : plan === 'reduce' ? 'Protection plan previewed. No order was submitted.' : 'Protection plan previewed. No stop order was submitted.')
    window.setTimeout(() => setToast(''), 5000)
  }

  const copyCandidate = leaders.find((leader) => leader.account_id === selectedTrader)
  const simulateCopy = () => {
    setCopyState('')
    setPaperCopy(null)
    if (!copyCandidate) return setCopyState('Choose a trader first.')
    if (!account) return setCopyState('Connect your Strike account first so Ospaz can calculate the paper allocation from your available balance.')
    const allocation = Number(copyAllocation)
    if (!Number.isFinite(allocation) || allocation <= 0 || allocation > 100) return setCopyState('Enter an allocation between 1 and 100 percent.')
    const available = Number(account.available_balance)
    if (!Number.isFinite(available) || available < 0) return setCopyState('Available balance is unavailable. Refresh your authenticated Strike account data and try again.')
    const trader = displayText(copyCandidate.nickname || copyCandidate.ada_handle || copyCandidate.account_id.slice(0, 8))
    const nextCopy: PaperCopy = { id: `PAPER-${Date.now().toString(36).toUpperCase()}`, trader, allocationPct: allocation, amount: available * allocation / 100, createdAt: new Date().toISOString(), status: 'simulated' }
    setPaperCopy(nextCopy)
    setCopyState(`Paper copy simulated for ${trader}. No order, margin transfer, or wallet transaction was sent to Strike.`)
  }

  const openWalletPicker = () => {
    setWalletOptions(discoverWallets())
    setShowWalletPicker(true)
  }

  const chooseWallet = async (wallet: WalletOption) => {
    try {
      const address = await connectWallet(wallet.provider)
      await authenticateWallet(wallet.provider, address)
      setWalletAddress(address)
      setWalletName(wallet.name)
      setShowWalletPicker(false)
      setToast(`${wallet.name} connected: ${address.slice(0, 6)}…${address.slice(-4)}`)
      window.setTimeout(() => setToast(''), 5000)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Wallet connection was cancelled')
      window.setTimeout(() => setToast(''), 5000)
    }
  }

  return <main className={theme === 'dark' ? 'theme-dark' : ''}>
    <nav>
      <a className="brand" href="#top"><span className="brand-mark"><Icon name="shield" /></span>ospaz</a>
      <div className="nav-links"><a href="#position">My position</a><a href="#monitor">AI monitor</a><a href="#how">How it works</a></div>
      <div className="nav-actions"><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><span className="theme-dot"></span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button><button className="wallet-button" onClick={openWalletPicker}><Icon name="wallet" /> {walletAddress ? `${walletName} ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Connect wallet'}</button></div>
    </nav>

    <section className="hero" id="top">
      <div className="eyebrow"><span></span> Your safety layer for perpetuals</div>
      <h1>Trade with conviction.<br /><em>Not fear.</em></h1>
      <p>Ospaz turns complex liquidation risk into a clear plan. Protect your position before the market decides for you.</p>
      <div className="hero-actions"><button className="primary" onClick={() => setShowPlan(true)}>Protect my position <Icon name="arrow" /></button><button className="text-button" onClick={() => document.querySelector('#how')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</button></div>
      <div className="live-pill"><i></i> {markPrice ? `Live Strike ${displaySymbol(markPrice.s)} mark price` : 'Connecting to Strike mainnet'} {dataError && <button onClick={() => setToast(dataError)}>Details</button>}</div>
    </section>

    <section className="dashboard" id="position">
      <div className="section-head"><div><span className="overline">DEMO POSITION. LIVE MARKET PRICE.</span><h2>BTC / USD <b>Long</b></h2></div><div className="price"><span>Strike mark price</span><strong>{markPrice ? usd.format(price) : 'Loading…'}</strong><small>{markPrice ? `Index ${usd.format(Number(markPrice.i))}` : 'Waiting for price stream'}</small></div></div>
      <div className="grid">
        <article className="risk-card">
          <div className="card-label"><span>Liquidation risk</span><button className="info">i</button></div>
          <div className="risk-content"><div className="gauge" style={{ '--risk': `${risk * 3.6}deg` } as React.CSSProperties}><div className="gauge-inner"><strong>{risk}%</strong><span>{protectedPlan ? 'Previewed' : 'Elevated'}</span></div></div><div className="risk-copy"><h3>{protectedPlan ? 'Your plan is ready for review.' : 'You are getting too close.'}</h3><p>{protectedPlan ? 'This is a demo position. Ospaz has not submitted any trading or margin instruction.' : 'This demo position uses the live Strike mark price; connect an authenticated account before relying on personal risk data.'}</p></div></div>
          <div className="risk-scale"><span>Safe</span><span>Watch</span><span>Danger</span></div>
        </article>
        <article className="metrics-card">
          <span className="card-label">Position health</span>
          <div className="metric"><span>Entry price</span><strong>$65,240.00</strong></div>
          <div className="metric"><span>Liquidation price</span><strong className={protectedPlan ? 'safe' : 'danger'}>${liquidationPrice.toLocaleString()}.00</strong></div>
          <div className="metric"><span>Distance to liquidation</span><strong>{safety.toFixed(1)}%</strong></div>
          <div className="metric"><span>Unrealized PnL</span><strong className="positive">+ $171.20</strong></div>
          <div className="health-bar"><span style={{ width: `${100 - risk}%` }}></span></div>
        </article>
      </div>
    </section>

    <section className="alert">
      <div className="alert-icon"><Icon name="bolt" /></div><div><span className="overline">OSPAZ SIGNAL</span><h3>{protectedPlan ? 'Protection is active' : 'Your position needs attention'}</h3><p>{protectedPlan ? 'We’ll keep watching your position and tell you if the risk changes.' : 'Your margin ratio is approaching Strike’s warning zone. Choose a safety plan before your options narrow.'}</p></div>
      <button className="primary" onClick={() => setShowPlan(true)}>{protectedPlan ? 'Review protection' : 'See my options'} <Icon name="arrow" /></button>
    </section>

    <section className="monitor" id="monitor">
      <div className="monitor-top"><div><span className="overline">OSPAZ AI MONITOR</span><h2>See what is working before you trust it.</h2><p>One plain language analysis for your Strike bots, native vaults, and copy trader candidates.</p></div><button className="primary" onClick={() => { setLastScan('Refreshing live public data'); void Promise.all([loadVaults(), loadLeaders()]).then(([nextVaults, nextLeaders]) => { setVaults(nextVaults); setLeaders(nextLeaders); setLastScan('Live public data refreshed') }).catch(() => setDataError('Could not refresh live public data.')) }}><Icon name="bolt" /> Run analysis</button></div>
      <div className="monitor-shell">
        <div className="monitor-tabs" role="tablist" aria-label="Ospaz monitor categories">
          <button className={monitorTab === 'bots' ? 'selected' : ''} onClick={() => setMonitorTab('bots')} role="tab" aria-selected={monitorTab === 'bots'}>Bot health</button>
          <button className={monitorTab === 'vaults' ? 'selected' : ''} onClick={() => setMonitorTab('vaults')} role="tab" aria-selected={monitorTab === 'vaults'}>Vault check</button>
          <button className={monitorTab === 'traders' ? 'selected' : ''} onClick={() => setMonitorTab('traders')} role="tab" aria-selected={monitorTab === 'traders'}>Copy trader fit</button>
          <span className="scan-time"><i></i>{lastScan}</span>
        </div>
        <div className="monitor-intro">
          {monitorTab === 'bots' && <><span className="monitor-icon"><Icon name="bolt" /></span><div><h3>Bot health, without guessing</h3><p>Ospaz flags a bot only from recorded status, strategy progress, child order activity, and clear errors.</p></div></>}
          {monitorTab === 'vaults' && <><span className="monitor-icon"><Icon name="shield" /></span><div><h3>Vault eligibility, clearly defined</h3><p>“Operational” means the public record is active and has the required health signals. It is not an investment recommendation.</p></div></>}
          {monitorTab === 'traders' && <><span className="monitor-icon"><Icon name="chart" /></span><div><h3>Copy with context</h3><p>Success rate means historical winning-trade percentage. Ospaz pairs it with drawdown and history length before recommending a fit.</p></div></>}
        </div>
        {monitorTab === 'bots' && <div className="monitor-list">{monitorData.bots.map((item) => <article className="monitor-row" key={item.name}><div className="row-title"><strong>{displayText(item.name)}</strong></div><div className="row-analysis"><b className={account ? 'good' : 'bad'}>{displayText(item.status)}</b><small>{displayText(item.detail)}</small></div><div className="row-metric"><span className={account ? 'status-active' : 'status-stopped'}>{displayText(item.tag!)}</span></div></article>)}</div>}
        {monitorTab === 'vaults' && <div className="data-card-grid-list">{vaults.length ? vaults.slice(0, 6).map((vault) => <VaultCard key={vault.vault_id} vault={vault} maxEquity={Math.max(...vaults.map((entry) => Number(entry.equity) || 0), 1)} />) : <div className="empty-state">Waiting for live vault data.</div>}</div>}
        {monitorTab === 'traders' && <div className="data-card-grid-list">{leaders.filter((leader) => leader.total_trades >= 10).slice(0, 6).map((leader) => <TraderCard key={leader.account_id} leader={leader} selected={selectedTrader === leader.account_id} onChoose={() => { setSelectedTrader(leader.account_id); setCopyState('') }} />)}</div>}
        <div className="monitor-disclosure"><span>{markPrice ? 'Live mainnet data' : 'Connecting'}</span> Vault and trader analytics are read from Strike public APIs. Account and position data use your authenticated read only API wallet. Ospaz will not place an order during monitoring.</div>
      </div>
      <div className="copy-panel">
        <div><span className="overline">COPY TRADING</span><h3>Test a trader without sending an order.</h3><p>Select a public trader, choose the percentage of your available balance to allocate, and create a paper copy. Real execution stays disabled.</p></div>
        <div className="copy-controls"><div className={`copy-target ${copyCandidate ? '' : 'empty'}`}><span>Selected trader</span><strong>{copyCandidate ? displayText(copyCandidate.nickname || copyCandidate.ada_handle || copyCandidate.account_id.slice(0, 8)) : 'Choose one above'}</strong></div><label>Allocation %<input inputMode="decimal" value={copyAllocation} onChange={(event) => setCopyAllocation(event.target.value)} /></label><button className="primary" onClick={simulateCopy}>Simulate copy <Icon name="arrow" /></button></div>
        {copyCandidate && <div className="copy-summary"><strong>{displayText(copyCandidate.nickname || copyCandidate.ada_handle || copyCandidate.account_id.slice(0, 8))}</strong><span>{copyCandidate.total_trades} trades</span><span>{Number(copyCandidate.win_rate_pct).toFixed(1)}% win rate</span><span>{Number(copyCandidate.max_drawdown_pct).toFixed(1)}% max drawdown</span></div>}
        {copyState && <p className="copy-state">{copyState}</p>}
        {paperCopy && <div className="paper-receipt" aria-live="polite"><div><span>Paper receipt</span><strong>{paperCopy.id}</strong></div><div><span>Simulated allocation</span><strong>{usd.format(paperCopy.amount)} ({paperCopy.allocationPct}%)</strong></div><div><span>Execution status</span><strong className="good-text">Simulated only</strong></div><button className="text-button" onClick={() => { setPaperCopy(null); setCopyState('Paper copy cleared locally. No Strike state changed.') }}>Clear paper copy</button></div>}
      </div>
    </section>

    <section className="how" id="how"><span className="overline">HOW IT WORKS</span><h2>Live market facts. Clear personal decisions.</h2><p className="how-intro">Ospaz separates what Strike publishes publicly from what only you can approve with your account.</p><div className="steps"><div><span>01</span><Icon name="chart" /><h3>Read the live market</h3><p>Ospaz receives the Strike BTC / USD mark price, index price, and funding data as it updates.</p></div><div><span>02</span><Icon name="bolt" /><h3>Check public records</h3><p>Vault status, verification, equity, trader history, win rate, and drawdown are assessed from Strike public data.</p></div><div><span>03</span><Icon name="shield" /><h3>Protect your privacy</h3><p>Your personal positions and bot activity stay unavailable until you choose to connect a dedicated Strike API wallet.</p></div><div><span>04</span><Icon name="wallet" /><h3>You approve every action</h3><p>Today, protection choices are previews only. Ospaz does not submit a trade, margin transfer, or stop order.</p></div></div></section>

    {showPlan && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPlan(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><button className="close" aria-label="Close" onClick={() => setShowPlan(false)}><Icon name="close" /></button><span className="overline">OSPAZ PROTECTION PLAN</span><h2 id="modal-title">Make this trade safer</h2><p className="modal-intro">Choose an action. Nothing is sent to Strike until you approve.</p><button className="plan recommended" onClick={() => protect('margin')}><span className="plan-icon"><Icon name="shield" /></span><span><b>Add $20 margin <em>Recommended</em></b><small>Moves liquidation to $60,130 and keeps your full position open.</small></span><Icon name="arrow" /></button><button className="plan" onClick={() => protect('reduce')}><span className="plan-icon"><Icon name="chart" /></span><span><b>Close 25% of my position</b><small>Reduces exposure and moves liquidation to $61,740.</small></span><Icon name="arrow" /></button><button className="plan" onClick={() => protect('stop')}><span className="plan-icon"><Icon name="bolt" /></span><span><b>Set a protective stop</b><small>Exit automatically at $62,880 before liquidation.</small></span><Icon name="arrow" /></button><p className="fine-print">Demo only. In production, Ospaz will require a connected Strike account and confirmation before submitting any order.</p></section></div>}
    {showWalletPicker && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowWalletPicker(false)}><section className="modal wallet-picker" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onMouseDown={(event) => event.stopPropagation()}><button className="close" aria-label="Close" onClick={() => setShowWalletPicker(false)}><Icon name="close" /></button><span className="overline">WALLET CONNECTION</span><h2 id="wallet-title">Choose a wallet</h2><p className="modal-intro">Ospaz requests only your public address. It never reads or stores your private key.</p>{walletOptions.length ? walletOptions.map((wallet) => <button className="wallet-option" key={wallet.id} onClick={() => void chooseWallet(wallet)}><span className="wallet-option-mark">{wallet.name.slice(0, 1)}</span><span><b>{wallet.name}</b><small>{wallet.detail}</small></span><Icon name="arrow" /></button>) : <div className="wallet-empty"><strong>No browser wallet detected</strong><p>Install the <a href="https://www.okx.com/web3" target="_blank" rel="noreferrer">OKX Wallet extension</a>, unlock it, then reload this page.</p></div>}</section></div>}
    {toast && <div className="toast"><Icon name="shield" />{toast}</div>}
    <footer><a className="brand" href="#top"><span className="brand-mark"><Icon name="shield" /></span>ospaz</a><span>Built for safer perpetual trading on Strike.</span></footer>
  </main>
}
