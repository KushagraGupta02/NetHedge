# Contract Updates Summary

## Changes Made:

### 1. **Separate Betting and Monitoring Periods**

**Before:**
- `endTime` - When both betting and monitoring ended

**After:**
- `bettingEndTime` - When betting closes
- `monitoringEndTime` - When actual uptime monitoring ends
- `resolutionTime` - Deadline for oracle to submit result

**Timeline:**
```
Start → Betting Period → Monitoring Period → Resolution
  |          ↓                  ↓                ↓
  |     bettingEndTime    monitoringEndTime  resolutionTime
  |     (users bet)       (oracle monitors)  (oracle submits)
```

### 2. **Uptime Check Tracking**

New struct added:
```solidity
struct UptimeCheck {
    uint256 timestamp;
    bool isUp;
    uint256 responseTime; // in milliseconds
}
```

New functions:
- `addUptimeCheck()` - Oracle adds data points during monitoring
- `getUptimeChecks()` - View function to retrieve all checks for graphing

### 3. **Updated createMarket Function**

Now requires TWO durations:
```solidity
createMarket(url, bettingDuration, monitoringDuration)
```

Example:
- Betting: 24 hours (users place bets)
- Monitoring: 72 hours (oracle checks uptime)
- Total: 96 hours + 1 hour for oracle submission

## Frontend Updates Needed:

### Files to Update:

1. **Create Market Page** (`/markets/create/page.tsx`)
   - Add second duration field for monitoring period
   - Update createMarket call to pass both durations

2. **Market Detail Page** (`/markets/[id]/page.tsx`)
   - Update to use `bettingEndTime` instead of `endTime`
   - Add uptime graph component
   - Show different status for betting vs monitoring phase

3. **Hooks** (`/hooks/uptime/`)
   - Update Market type definition
   - Add `useUptimeChecks` hook

4. **Oracle Contract** (`UptimeOracle.sol`)
   - Add `addUptimeCheck` function
   - Update `reportUptime` to use final calculation

## Graph Visualization:

The uptime checks can be visualized showing:
- Timeline (X-axis): timestamps
- Uptime status (Y-axis): up (100%) or down (0%)
- Response times (secondary Y-axis or tooltip)

This will show exactly when the website was up/down during the monitoring period!
