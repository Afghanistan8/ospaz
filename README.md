# Ospaz

**A safety layer for perpetual traders.**

Ospaz translates difficult liquidation and margin data into clear, user-controlled protection plans. It is designed for the Strike Finance hackathon concept: a trader sees when their position is at risk, understands the available responses, and explicitly approves the action they want to take.

## Current prototype

- Live-style BTC mark-price updates in a safe demo environment
- A clear liquidation-risk gauge and position-health panel
- One-click protection-plan simulation: add margin, reduce the position, or set a protective stop
- AI Monitor workspace for bot health, native-vault eligibility, and copy-trader fit
- Verified read-only Strike mainnet data: BTC mark-price WebSocket, public vaults, and trader statistics
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

Serve the production bundle and its same-origin live-data bridge with:

```bash
npm run start
```

The bridge only permits the public endpoints Ospaz uses. It does not hold an API private key and it cannot submit an order.

## Production integration plan

1. Create a dedicated Strike API wallet for Ospaz. Do not paste its private key into chat, source code, or a public deployment.
2. Add an explicit, read-only authenticated account connection for balances, positions, Grid bots, and TWAP strategies.
3. Connect authenticated Grid and TWAP endpoints, then score bot health from the documented status, child-order state, strategy progress, and explicit errors.
4. Calculate personal risk with Strike's published liquidation model.
5. Require explicit confirmation before calling authenticated order or margin endpoints.
6. Display every requested and completed protective action in an audit trail.

Ospaz should advise and prepare actions; traders retain the final decision.
