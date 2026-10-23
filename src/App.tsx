import { useEffect, useMemo, useState } from 'react'

type Plan = 'margin' | 'reduce' | 'stop'
type MonitorTab = 'bots' | 'vaults' | 'traders'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const monitorData = {
  bots: [
    { name: 'BTC neutral grid', symbol: 'BTC-USD', status: 'Needs attention', detail: 'No child-order fill recorded in the last 18 minutes.', tag: 'Check range' },
    { name: 'ETH accumulation TWAP', symbol: 'ETH-USD', status: 'Working normally', detail: '12 of 16 slices have fired; strategy remains active.', tag: 'Active' },
    { name: 'SOL momentum grid', symbol: 'SOL-USD', status: 'Stopped', detail: 'Strike reports this grid bot as stopped. No new orders can be placed.', tag: 'Stopped' },
  ],
  vaults: [
    { name: 'Delta Harbor', status: 'Operational signals present', detail: 'Active · verified · positive equity · Sharpe data available', metric: '12.4% 30D return' },
    { name: 'Northstar Macro', status: 'Review before depositing', detail: 'Active, but no verified badge in this demo record.', metric: '6.2% 30D return' },
    { name: 'Orbit Yield', status: 'Not accepting new capital', detail: 'Vault status is paused. This is not an eligible deposit target.', metric: 'Paused' },
  ],
  traders: [
    { name: 'LumenTrades', status: 'Compatible with your safety profile', detail: 'Historical win rate is stable and drawdown remains inside your selected limit.', metric: '68.4% win rate' },
    { name: 'PerpPilot_09', status: 'High return, high risk', detail: 'Historical success rate is strong, but maximum drawdown exceeds your safety preference.', metric: '74.1% win rate' },
    { name: 'Mercury Loop', status: 'Too little history', detail: 'Not enough completed-trade history to score responsibly.', metric: 'Insufficient data' },
  ],
} as const

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
  const [price, setPrice] = useState(67_482.4)
  const [protectedPlan, setProtectedPlan] = useState<Plan | null>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [toast, setToast] = useState('')
  const [mode, setMode] = useState<'live' | 'demo'>('demo')
  const [monitorTab, setMonitorTab] = useState<MonitorTab>('bots')
  const [lastScan, setLastScan] = useState('Ready to analyze')

  useEffect(() => {
    const timer = window.setInterval(() => setPrice((value) => Number((value + (Math.random() - .48) * 32).toFixed(1))), 2200)
    return () => window.clearInterval(timer)
  }, [])

  const risk = protectedPlan ? 58 : 82
  const liquidationPrice = protectedPlan === 'margin' ? 60_130 : protectedPlan === 'reduce' ? 61_740 : protectedPlan === 'stop' ? 62_880 : 62_010
  const safety = useMemo(() => Math.max(0, ((price - liquidationPrice) / price) * 100), [price, liquidationPrice])

  const protect = (plan: Plan) => {
    setProtectedPlan(plan)
    setShowPlan(false)
    setToast(plan === 'margin' ? 'Margin added. Your position has more room to breathe.' : plan === 'reduce' ? '25% of your position was marked for a reduce-only close.' : 'Protective stop set at $62,880.')
    window.setTimeout(() => setToast(''), 5000)
  }

  return <main>
    <nav>
      <a className="brand" href="#top"><span className="brand-mark"><Icon name="shield" /></span>ospaz</a>
      <div className="nav-links"><a href="#position">My position</a><a href="#monitor">AI monitor</a><a href="#how">How it works</a></div>
      <button className="wallet-button"><Icon name="wallet" /> Connect Strike</button>
    </nav>

    <section className="hero" id="top">
      <div className="eyebrow"><span></span> Your safety layer for perpetuals</div>
      <h1>Trade with conviction.<br /><em>Not fear.</em></h1>
      <p>Ospaz turns complex liquidation risk into a clear plan—so you can protect your position before the market decides for you.</p>
      <div className="hero-actions"><button className="primary" onClick={() => setShowPlan(true)}>Protect my position <Icon name="arrow" /></button><button className="text-button" onClick={() => document.querySelector('#how')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</button></div>
      <div className="live-pill"><i></i> {mode === 'demo' ? 'Demo mode · simulated Strike account' : 'Live account connected'} <button onClick={() => setMode(mode === 'demo' ? 'live' : 'demo')}>Switch</button></div>
    </section>

    <section className="dashboard" id="position">
      <div className="section-head"><div><span className="overline">ACTIVE POSITION</span><h2>BTC-USD <b>Long</b></h2></div><div className="price"><span>Mark price</span><strong>{usd.format(price)}</strong><small>+1.84% today</small></div></div>
      <div className="grid">
        <article className="risk-card">
          <div className="card-label"><span>Liquidation risk</span><button className="info">i</button></div>
          <div className="risk-content"><div className="gauge" style={{ '--risk': `${risk * 3.6}deg` } as React.CSSProperties}><div className="gauge-inner"><strong>{risk}%</strong><span>{protectedPlan ? 'Protected' : 'Elevated'}</span></div></div><div className="risk-copy"><h3>{protectedPlan ? 'You are in a safer zone.' : 'You are getting too close.'}</h3><p>{protectedPlan ? 'Your protective action has increased your distance from liquidation.' : 'A 8.1% BTC drop could liquidate this position. Take action while you still have options.'}</p></div></div>
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
      <div className="monitor-top"><div><span className="overline">OSPAZ AI MONITOR</span><h2>See what is working before you trust it.</h2><p>One plain-language analysis for your Strike bots, native vaults, and copy-trader candidates.</p></div><button className="primary" onClick={() => { setLastScan('Analysis refreshed just now'); setToast('Ospaz AI Monitor has refreshed its assessment.'); window.setTimeout(() => setToast(''), 4000) }}><Icon name="bolt" /> Run analysis</button></div>
      <div className="monitor-shell">
        <div className="monitor-tabs" role="tablist" aria-label="Ospaz monitor categories">
          <button className={monitorTab === 'bots' ? 'selected' : ''} onClick={() => setMonitorTab('bots')} role="tab" aria-selected={monitorTab === 'bots'}>Bot health</button>
          <button className={monitorTab === 'vaults' ? 'selected' : ''} onClick={() => setMonitorTab('vaults')} role="tab" aria-selected={monitorTab === 'vaults'}>Vault check</button>
          <button className={monitorTab === 'traders' ? 'selected' : ''} onClick={() => setMonitorTab('traders')} role="tab" aria-selected={monitorTab === 'traders'}>Copy trader fit</button>
          <span className="scan-time"><i></i>{lastScan}</span>
        </div>
        <div className="monitor-intro">
          {monitorTab === 'bots' && <><span className="monitor-icon"><Icon name="bolt" /></span><div><h3>Bot health, without guessing</h3><p>Ospaz flags a bot only from recorded status, strategy progress, child-order activity, and clear errors.</p></div></>}
          {monitorTab === 'vaults' && <><span className="monitor-icon"><Icon name="shield" /></span><div><h3>Vault eligibility, clearly defined</h3><p>“Operational” means the public record is active and has the required health signals. It is not an investment recommendation.</p></div></>}
          {monitorTab === 'traders' && <><span className="monitor-icon"><Icon name="chart" /></span><div><h3>Copy with context</h3><p>Success rate means historical winning-trade percentage. Ospaz pairs it with drawdown and history length before recommending a fit.</p></div></>}
        </div>
        <div className="monitor-list">
          {monitorData[monitorTab].map((item) => {
            const bot = 'symbol' in item ? item : null
            const scoredRecord = 'metric' in item ? item : null
            const tone = item.status.includes('Working') || item.status.includes('Operational') || item.status.includes('Compatible') ? 'good' : item.status.includes('Review') || item.status.includes('High') ? 'caution' : 'bad'
            return <article className="monitor-row" key={item.name}><div className="row-title"><strong>{item.name}</strong>{bot && <span>{bot.symbol}</span>}</div><div className="row-analysis"><b className={tone}>{item.status}</b><small>{item.detail}</small></div><div className="row-metric">{bot ? <span className={bot.tag === 'Active' ? 'status-active' : bot.tag === 'Check range' ? 'status-check' : 'status-stopped'}>{bot.tag}</span> : <strong>{scoredRecord?.metric}</strong>}</div></article>
          })}
        </div>
        <div className="monitor-disclosure"><span>Demo data</span> Connect a Strike account to analyze your authenticated grid bots and TWAP strategies. Public vault and trader analytics should be refreshed from their documented Strike data sources before a real decision.</div>
      </div>
    </section>

    <section className="how" id="how"><span className="overline">SIMPLE, NOT SIMPLISTIC</span><h2>Your position, translated into a plan.</h2><div className="steps"><div><span>01</span><Icon name="chart" /><h3>We watch the risk</h3><p>Live prices and your account health are read continuously.</p></div><div><span>02</span><Icon name="bolt" /><h3>We explain it plainly</h3><p>See what price movement means for your exact position.</p></div><div><span>03</span><Icon name="shield" /><h3>You stay in control</h3><p>Ospaz recommends protection. You review and approve every action.</p></div></div></section>

    {showPlan && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPlan(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><button className="close" aria-label="Close" onClick={() => setShowPlan(false)}><Icon name="close" /></button><span className="overline">OSPAZ PROTECTION PLAN</span><h2 id="modal-title">Make this trade safer</h2><p className="modal-intro">Choose an action. Nothing is sent to Strike until you approve.</p><button className="plan recommended" onClick={() => protect('margin')}><span className="plan-icon"><Icon name="shield" /></span><span><b>Add $20 margin <em>Recommended</em></b><small>Moves liquidation to $60,130 and keeps your full position open.</small></span><Icon name="arrow" /></button><button className="plan" onClick={() => protect('reduce')}><span className="plan-icon"><Icon name="chart" /></span><span><b>Close 25% of my position</b><small>Reduces exposure and moves liquidation to $61,740.</small></span><Icon name="arrow" /></button><button className="plan" onClick={() => protect('stop')}><span className="plan-icon"><Icon name="bolt" /></span><span><b>Set a protective stop</b><small>Exit automatically at $62,880 before liquidation.</small></span><Icon name="arrow" /></button><p className="fine-print">Demo only. In production, Ospaz will require a connected Strike account and confirmation before submitting any order.</p></section></div>}
    {toast && <div className="toast"><Icon name="shield" />{toast}</div>}
    <footer><a className="brand" href="#top"><span className="brand-mark"><Icon name="shield" /></span>ospaz</a><span>Built for safer perpetual trading on Strike.</span></footer>
  </main>
}
