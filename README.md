# Ospaz

**A safety layer for perpetual traders.**

Ospaz translates difficult liquidation and margin data into clear, user-controlled protection plans. It is designed for the Strike Finance hackathon concept: a trader sees when their position is at risk, understands the available responses, and explicitly approves the action they want to take.

## How it works

1. **Read live market data.** Ospaz subscribes to Strike mainnet BTC / USD mark price data and shows the current mark price, index price, and funding context.
2. **Check public records.** The monitor reads Strike public vault and trader statistics. It uses vault status, verification, equity, returns, win rate, trade count, and drawdown to give concise context.
3. **Keep your account private.** Personal positions, Grid bots, and TWAP strategies are not read until you explicitly connect a dedicated Strike API wallet. Ospaz must never request your private key.
4. **Preview protection.** The current protection choices are previews. They change the on screen demo only and cannot submit a trade, transfer margin, or create a stop order.

## Test it yourself in PowerShell

1. Open PowerShell and enter the project folder:

   ```powershell
   cd C:\Users\emman\Desktop\ospaz
   ```

2. Install the dependencies:

   ```powershell
   npm install
   ```

3. Build the production app. It should finish with `built in` and no errors:

   ```powershell
   npm run build
   ```

4. Start Ospaz:

   ```powershell
   npm run start
   ```

5. Open [http://localhost:4173](http://localhost:4173) in your browser. Keep the PowerShell window open.

6. Confirm live price data. The hero status should say `Live Strike BTC / USD mark price`, and the mark price in the position panel should populate. Wait a few seconds to see it refresh from Strike’s public WebSocket.

7. Test the display switch in the header. Select **Dark mode** and confirm the full interface changes to the dark canvas. Select **Light mode** to return. Refresh the page and confirm your choice is remembered.

8. Scroll to **Ospaz AI Monitor**. Select **Vault check** and **Copy trader fit**. The footer of that panel should say `Live mainnet data`, and the entries should populate from Strike public APIs.

9. Select **Bot health**. `Account connection required` is the expected result today. Bot monitoring is deliberately unavailable until you connect an authenticated read only API wallet.

10. Test the protection flow. Select **Protect my position**, choose any option, and confirm that the toast says it is a preview. No order, margin transfer, or wallet transaction should occur.

11. Stop the local server when you are done by selecting the PowerShell window and pressing `Ctrl + C`.

The local bridge only permits the public endpoints Ospaz uses. It does not hold an API private key and it cannot submit an order.

## Production integration plan

1. Create a dedicated Strike API wallet for Ospaz. Do not paste its private key into chat, source code, or a public deployment.
2. Add an explicit, read-only authenticated account connection for balances, positions, Grid bots, and TWAP strategies.
3. Connect authenticated Grid and TWAP endpoints, then score bot health from the documented status, child-order state, strategy progress, and explicit errors.
4. Calculate personal risk with Strike's published liquidation model.
5. Require explicit confirmation before calling authenticated order or margin endpoints.
6. Display every requested and completed protective action in an audit trail.

Ospaz should advise and prepare actions; traders retain the final decision.
