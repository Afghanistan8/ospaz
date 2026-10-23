# Ospaz

**A safety layer for perpetual traders.**

Ospaz translates difficult liquidation and margin data into clear, user-controlled protection plans. It is designed for the Strike Finance hackathon concept: a trader sees when their position is at risk, understands the available responses, and explicitly approves the action they want to take.

## Current prototype

- Live-style BTC mark-price updates in a safe demo environment
- A clear liquidation-risk gauge and position-health panel
- One-click protection-plan simulation: add margin, reduce the position, or set a protective stop
- AI Monitor workspace for bot health, native-vault eligibility, and copy-trader fit
- Responsive interface and clear user disclosures—nothing is submitted to an exchange in this prototype

## Run locally

```bash
npm install
npm run dev
```

Create a production bundle with:

```bash
npm run build
```

## Production integration plan

1. Connect Strike's authenticated user stream for account balances and positions.
2. Connect authenticated Grid and TWAP endpoints, then score bot health from the documented status, child-order state, strategy progress, and explicit errors.
3. Subscribe to Strike mark-price data for real-time risk changes.
4. Query public vault data, scoring eligibility from status, verification, equity, and available risk metrics—never calling a vault an investment recommendation.
5. Compute copy-trader success as a historical winning-trade percentage alongside drawdown and history length; it must never imply guaranteed returns.
6. Calculate risk with Strike's published liquidation model.
7. Require explicit confirmation before calling authenticated order or margin endpoints.
8. Display every requested and completed protective action in an audit trail.

Ospaz should advise and prepare actions; traders retain the final decision.
