# Mango Connector TODOs
## Directions/Goals
1. [ ] Create a Mango connector on **Gateway** that exposes an API similar to Injective's perp connector.
2. [ ] Create a **test script** on Hummingbot client that uses the Mango connector to do simple market making on Mango markets and which can be used by experienced traders to write their own strategies.
3. [ ] **Integrate** with the Hummingbot client to allow users to use any Hummingbot strategy and freely configure those to trade on Mango markets.
## TODOs
### Gateway
Optional: Write unit tests along the way instead of at the end.
1. [ ] Add initial functions to get general information from Mango market (orderbooks, trades, etc.)
2. [ ] Add functions to get information about user's account (balances, orders, etc.) and implement helpers to track opened accounts.
3. [ ] Add functions to place/cancel/modifiy orders.
4. [ ] Get perp trading specific information (funding, margin, etc.) if not yet implemented.
5. [ ] Align with Hummingbot's perp connector interface.

### Hummingbot Client
1. [ ] Add Mango test script.
2. [ ] Release Mango test script with README to Mango community.
3. [ ] Integrate data sources from Mango connector into Hummingbot client.
4. [ ] Integrate Mango connector into Hummingbot client.
5. [ ] List Mango connector on Hummingbot client as a connector option.
6. [ ] Update Hummingbot docs to include Mango connector.
7. [ ] Release Mango connector with a PRP to Hummingbot community.
8. [ ] Prepare community call to present Mango connector.
8. ???
9. Profit.