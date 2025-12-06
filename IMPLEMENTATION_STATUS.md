# NetHedge - Uptime Prediction Market Implementation Status

## ✅ Phase 1: Smart Contracts (COMPLETED)

### Contracts Developed

#### 1. UptimeMarket.sol
**Location:** `packages/hardhat/contracts/UptimeMarket.sol`

**Features:**
- ✅ Market creation for any website URL
- ✅ YES/NO betting pools with dynamic odds
- ✅ Market lifecycle (OPEN → MONITORING → RESOLVED → CANCELLED)
- ✅ Proportional payout calculation
- ✅ Platform fee system (2% configurable up to 10%)
- ✅ Emergency cancellation & refunds
- ✅ Security: ReentrancyGuard, Ownable, input validation

**Key Functions:**
- `createMarket(url, duration)` - Create new prediction market
- `placeBid(marketId, position)` - Bet YES or NO
- `closeMarket(marketId)` - Close betting period
- `resolveMarket(marketId, uptime%)` - Oracle resolves market
- `claimWinnings(marketId)` - Winners claim payouts
- `getOdds(marketId)` - View current odds
- `calculatePotentialWinnings()` - Estimate returns

**Parameters:**
- Minimum bet: 0.001 ETH
- Duration range: 1 hour - 30 days
- Uptime threshold: 99% (configurable)
- Platform fee: 200 basis points (2%)

#### 2. UptimeOracle.sol
**Location:** `packages/hardhat/contracts/UptimeOracle.sol`

**Features:**
- ✅ Authorized reporter system
- ✅ Uptime data submission (basis points)
- ✅ One-time reporting per market
- ✅ Direct integration with UptimeMarket

**Key Functions:**
- `reportUptime(marketId, uptimePercentage)` - Submit uptime data
- `setReporterAuthorization(address, bool)` - Manage reporters

### Testing

**Location:** `packages/hardhat/test/UptimeMarket.test.ts`

**Test Coverage:** 44 tests - ✅ ALL PASSING

**Test Categories:**
1. ✅ Deployment & initialization
2. ✅ Market creation (valid & invalid inputs)
3. ✅ Bidding mechanics (YES/NO positions)
4. ✅ Odds calculation (dynamic pool-based)
5. ✅ Market closing
6. ✅ Oracle resolution (YES/NO outcomes)
7. ✅ Winnings claiming (proportional payouts)
8. ✅ Fee distribution
9. ✅ Market cancellation & refunds
10. ✅ Admin functions & access control

**Gas Estimates:**
- createMarket: ~164,000 gas
- placeBid: ~122,000 - 238,000 gas (first bid higher)
- claimWinnings: ~86,000 gas
- resolveMarket: ~163,000 gas

### Deployment

**Script:** `packages/hardhat/deploy/01_deploy_uptime_contracts.ts`

**Deployment Flow:**
1. Deploy UptimeOracle
2. Deploy UptimeMarket
3. Connect contracts bidirectionally
4. Create sample market (localhost only)

**Verification:**
- ✅ Contracts compile successfully
- ✅ TypeChain types generated
- ✅ Ready for local/testnet deployment

---

## 🚧 Phase 2: Frontend (IN PROGRESS)

### Planned Pages

#### 1. Home/Markets List
**Route:** `/markets`
- Browse all active markets
- Filter by status (OPEN/MONITORING/RESOLVED)
- Display: URL, pools, odds, time remaining
- Quick bid interface

#### 2. Market Detail
**Route:** `/markets/[id]`
- Full market information
- YES/NO bidding interface with live odds
- Real-time pool updates
- Uptime display (when available)
- Claim winnings button
- User's position summary

#### 3. Create Market
**Route:** `/markets/create`
- Website URL input with validation
- Duration selector
- Market parameter configuration
- Gas estimation

#### 4. Portfolio
**Route:** `/portfolio`
- User's active positions
- Pending claims
- Historical bets
- P&L summary

### Components to Build

**Core Components:**
- `MarketCard` - Market summary card
- `BidInterface` - YES/NO betting UI
- `OddsDisplay` - Live odds visualization
- `CountdownTimer` - Time remaining
- `UptimeGauge` - Uptime percentage display
- `PositionSummary` - User's bids
- `ClaimButton` - Winnings claim

**Hooks:**
- `useMarkets()` - Fetch all markets
- `useMarket(id)` - Single market data
- `useUserPositions()` - User's bids
- `usePlaceBid()` - Place bet transaction
- `useClaimWinnings()` - Claim transaction

---

## 📋 Phase 3: Oracle Service (PLANNED)

### Off-Chain Uptime Monitor

**Technology Options:**
1. **Node.js Service** - Custom cron-based checker
2. **Chainlink Functions** - Decentralized HTTP requests
3. **Gelato Web3 Functions** - Automated uptime checks

**Features Required:**
- HTTP/HTTPS status checks
- Multi-location verification
- Consensus mechanism
- Automatic on-chain reporting
- Retry logic for failures

---

## 🎯 Next Steps

### Immediate (Current Session)
1. ✅ Smart contracts completed & tested
2. 🔄 Build markets list page
3. ⏳ Build market detail page
4. ⏳ Integrate with contracts
5. ⏳ Test end-to-end flow

### Short Term
6. Portfolio page
7. Create market UI
8. Admin dashboard
9. Analytics/statistics
10. Mobile responsive design

### Medium Term
11. Oracle service implementation
12. Automated market resolution
13. Multi-chain deployment
14. Subgraph for indexing
15. Social features (comments, sharing)

### Long Term
16. Advanced market types (tiered uptime)
17. Liquidity provider rewards
18. Governance token
19. Batch betting
20. Mobile app

---

## 🔒 Security Considerations

### Contract Security
- ✅ ReentrancyGuard on all payouts
- ✅ Access control (Ownable)
- ✅ Input validation
- ✅ Integer overflow protection (Solidity 0.8+)
- ⏳ Audit pending

### Oracle Security
- ⏳ Multi-reporter consensus
- ⏳ Reporter slashing for false data
- ⏳ Time-locked resolutions
- ⏳ Dispute mechanism

### Frontend Security
- ⏳ Transaction simulation before signing
- ⏳ Slippage protection
- ⏳ Phishing warnings
- ⏳ Input sanitization

---

## 💡 Key Design Decisions

**Market Resolution:**
- Binary outcome (uptime >= 99% = YES wins)
- Threshold: 9900 basis points (configurable)

**Payout Model:**
- Pool-based (like Polymarket)
- Proportional distribution
- Platform takes 2% fee on winnings only

**Oracle Trust:**
- MVP: Centralized authorized reporters
- Future: Decentralized via Chainlink/UMA

**Time Management:**
- Market duration: User-defined (1hr - 30 days)
- Resolution buffer: 1 hour after monitoring ends
- No automatic resolution (oracle required)

---

## 📊 Current Statistics

- **Lines of Solidity:** ~670
- **Test Cases:** 44 (100% passing)
- **Test Coverage:** ~95% of critical paths
- **Gas Optimizations:** Medium (can optimize further)
- **External Dependencies:** OpenZeppelin v5.1.0

---

## 🚀 Deployment Checklist

### Localhost (Testing)
- ✅ Contracts compile
- ✅ Tests pass
- ✅ Deployment script ready
- ⏳ Run `yarn chain`
- ⏳ Run `yarn deploy`
- ⏳ Run `yarn start`

### Testnet (Sepolia/Mumbai)
- ⏳ Configure `.env` with private key
- ⏳ Get testnet ETH
- ⏳ Deploy with `yarn deploy --network sepolia`
- ⏳ Verify contracts on Etherscan
- ⏳ Set up oracle reporters
- ⏳ Test with real users

### Mainnet
- ⏳ Security audit
- ⏳ Gas optimization review
- ⏳ Economic model validation
- ⏳ Legal review
- ⏳ Insurance fund setup
- ⏳ Gradual rollout plan

---

**Last Updated:** 2025-12-06
**Status:** Phase 1 Complete ✅ | Phase 2 In Progress 🚧
