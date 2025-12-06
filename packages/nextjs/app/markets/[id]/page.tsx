"use client";

import { use, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address } from "@scaffold-ui/components";
import { useMarket, useOdds, useUserBids, usePlaceBid, useClaimWinnings, useUptimeChecks, useCloseMarket } from "~~/hooks/uptime";
import { UptimeGraph } from "~~/components/UptimeGraph";

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = BigInt(id);
  const { address: connectedAddress } = useAccount();

  const { market, isLoading, refetch } = useMarket(marketId);
  const { yesOdds, noOdds } = useOdds(marketId);
  const { bids, totalBidAmount, refetch: refetchBids } = useUserBids(marketId);
  const { placeBid, isPending: isPlacingBid } = usePlaceBid();
  const { claimWinnings, isPending: isClaiming } = useClaimWinnings();
  const { closeMarket, isPending: isClosing } = useCloseMarket();
  const { checks } = useUptimeChecks(marketId);

  const [bidAmount, setBidAmount] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<0 | 1>(0); // 0=YES, 1=NO

  if (isLoading || !market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-base-300 rounded w-1/2 mb-4"></div>
          <div className="h-64 bg-base-300 rounded"></div>
        </div>
      </div>
    );
  }

  const statusNames = ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"];
  const statusColors = ["badge-success", "badge-warning", "badge-info", "badge-error"];
  const totalPool = market.yesPool + market.noPool;
  const yesPercentage = totalPool > 0n ? (Number(market.yesPool) * 100) / Number(totalPool) : 50;

  const handlePlaceBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) < 0.001) {
      alert("Minimum bet is 0.001 ETH");
      return;
    }

    try {
      await placeBid(marketId, selectedPosition, parseEther(bidAmount));
      setBidAmount("");
      refetch();
      refetchBids();
    } catch (error) {
      console.error("Error placing bid:", error);
    }
  };

  const handleClaim = async () => {
    try {
      await claimWinnings(marketId);
      refetchBids();
      refetch();
    } catch (error) {
      console.error("Error claiming:", error);
    }
  };

  const handleCloseMarket = async () => {
    try {
      await closeMarket(marketId);
      refetch();
    } catch (error) {
      console.error("Error closing market:", error);
    }
  };

  const canClaim =
    market.status === 2 &&
    bids.length > 0 &&
    bids.some(bid => !bid.claimed && ((market.outcome && bid.position === 0) || (!market.outcome && bid.position === 1)));

  const bettingTimeRemaining = Number(market.bettingEndTime) * 1000 - Date.now();
  const isBettingEnded = bettingTimeRemaining <= 0;
  const monitoringTimeRemaining = Number(market.monitoringEndTime) * 1000 - Date.now();
  const isMonitoringEnded = monitoringTimeRemaining <= 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{market.websiteUrl}</h1>
            <div className="flex gap-2 items-center">
              <div className={`badge ${statusColors[market.status]}`}>{statusNames[market.status]}</div>
              <span className="text-sm text-base-content/60">Market #{id}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-base-content/60">Created by</div>
            <Address address={market.creator} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Uptime Graph - Always show */}
          <UptimeGraph
            checks={checks || []}
            websiteUrl={market.websiteUrl}
            isMonitoringEnded={isMonitoringEnded}
            status={market.status}
          />

          {/* Pool Stats */}
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title">Market Pools</h2>

              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-success">YES {yesPercentage.toFixed(1)}%</span>
                <span className="font-semibold text-error">NO {(100 - yesPercentage).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-6">
                <div
                  className="bg-success h-6 rounded-full transition-all flex items-center justify-start px-2"
                  style={{ width: `${yesPercentage}%` }}
                >
                  {yesPercentage > 15 && <span className="text-xs font-bold text-white">YES</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="stats shadow">
                  <div className="stat p-4">
                    <div className="stat-title text-xs">YES Pool</div>
                    <div className="stat-value text-xl text-success">{formatEther(market.yesPool)}</div>
                    <div className="stat-desc">ETH</div>
                  </div>
                </div>
                <div className="stats shadow">
                  <div className="stat p-4">
                    <div className="stat-title text-xs">NO Pool</div>
                    <div className="stat-value text-xl text-error">{formatEther(market.noPool)}</div>
                    <div className="stat-desc">ETH</div>
                  </div>
                </div>
                <div className="stats shadow">
                  <div className="stat p-4">
                    <div className="stat-title text-xs">Total Pool</div>
                    <div className="stat-value text-xl">{formatEther(totalPool)}</div>
                    <div className="stat-desc">ETH</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Odds */}
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title">Current Odds</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-sm text-base-content/60">YES</div>
                  <div className="text-3xl font-bold text-success">{yesOdds.toFixed(2)}x</div>
                </div>
                <div className="text-center p-4 bg-error/10 rounded-lg">
                  <div className="text-sm text-base-content/60">NO</div>
                  <div className="text-3xl font-bold text-error">{noOdds.toFixed(2)}x</div>
                </div>
              </div>
            </div>
          </div>

          {/* Result (if resolved) */}
          {market.status === 2 && (
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <div>
                <h3 className="font-bold">Market Resolved</h3>
                <div className="text-xs">
                  Uptime: {Number(market.uptimePercentage) / 100}% - {market.outcome ? "YES" : "NO"} wins!
                </div>
              </div>
            </div>
          )}

          {/* Your Bids */}
          {connectedAddress && bids.length > 0 && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h2 className="card-title">Your Positions</h2>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Position</th>
                        <th>Amount</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((bid, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={`badge ${bid.position === 0 ? "badge-success" : "badge-error"}`}>
                              {bid.position === 0 ? "YES" : "NO"}
                            </span>
                          </td>
                          <td>{formatEther(bid.amount)} ETH</td>
                          <td className="text-xs">
                            {new Date(Number(bid.timestamp) * 1000).toLocaleString()}
                          </td>
                          <td>
                            {bid.claimed ? (
                              <span className="badge badge-ghost">Claimed</span>
                            ) : market.status === 2 ? (
                              (market.outcome && bid.position === 0) || (!market.outcome && bid.position === 1) ? (
                                <span className="badge badge-success">Winner</span>
                              ) : (
                                <span className="badge badge-ghost">Lost</span>
                              )
                            ) : (
                              <span className="badge badge-info">Active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-sm font-semibold">Total Bet: {formatEther(totalBidAmount)} ETH</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Place Bid Card */}
          {market.status === 0 && !isBettingEnded && (
            <div className="card bg-primary text-primary-content">
              <div className="card-body">
                <h2 className="card-title">Place Your Bid</h2>

                {/* Position Selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    className={`btn flex-1 ${selectedPosition === 0 ? "btn-success" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(0)}
                  >
                    YES
                  </button>
                  <button
                    className={`btn flex-1 ${selectedPosition === 1 ? "btn-error" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(1)}
                  >
                    NO
                  </button>
                </div>

                {/* Amount Input */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-primary-content">Amount (ETH)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.001"
                    className="input input-bordered text-base-content"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                  />
                  <label className="label">
                    <span className="label-text-alt text-primary-content">Minimum: 0.001 ETH</span>
                  </label>
                </div>

                {/* Potential Return */}
                {bidAmount && parseFloat(bidAmount) >= 0.001 && (
                  <div className="bg-primary-content/20 p-3 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span>Potential Return:</span>
                      <span className="font-bold">
                        {((parseFloat(bidAmount) * (selectedPosition === 0 ? yesOdds : noOdds)) * 0.98).toFixed(4)} ETH
                      </span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">After 2% platform fee</div>
                  </div>
                )}

                <button
                  className="btn btn-accent mt-4"
                  onClick={handlePlaceBid}
                  disabled={!connectedAddress || isPlacingBid || !bidAmount || parseFloat(bidAmount) < 0.001}
                >
                  {isPlacingBid ? <span className="loading loading-spinner"></span> : null}
                  {!connectedAddress ? "Connect Wallet" : isPlacingBid ? "Placing Bid..." : "Place Bid"}
                </button>
              </div>
            </div>
          )}

          {/* Close Market - Transition to Monitoring */}
          {market.status === 0 && isBettingEnded && (
            <div className="card bg-warning text-warning-content">
              <div className="card-body">
                <h2 className="card-title">Betting Ended</h2>
                <p className="text-sm">
                  The betting period has ended. Click below to close the market and start the monitoring phase.
                </p>
                <button
                  className="btn btn-accent mt-2"
                  onClick={handleCloseMarket}
                  disabled={isClosing}
                >
                  {isClosing ? <span className="loading loading-spinner"></span> : null}
                  {isClosing ? "Closing..." : "Start Monitoring Phase"}
                </button>
              </div>
            </div>
          )}

          {/* Claim Winnings */}
          {canClaim && (
            <div className="card bg-success text-success-content">
              <div className="card-body">
                <h2 className="card-title">Congratulations!</h2>
                <p>You won! Claim your winnings now.</p>
                <button className="btn btn-accent" onClick={handleClaim} disabled={isClaiming}>
                  {isClaiming ? <span className="loading loading-spinner"></span> : null}
                  {isClaiming ? "Claiming..." : "Claim Winnings"}
                </button>
              </div>
            </div>
          )}

          {/* Market Info */}
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-sm">Market Timeline</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Total Bids:</span>
                  <span className="font-semibold">{market.totalBids.toString()}</span>
                </div>
                <div className="divider my-1"></div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Start Time:</span>
                  <span className="font-semibold text-xs">
                    {new Date(Number(market.startTime) * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Betting Closes:</span>
                  <span className="font-semibold text-xs">
                    {new Date(Number(market.bettingEndTime) * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Monitoring Ends:</span>
                  <span className="font-semibold text-xs">
                    {new Date(Number(market.monitoringEndTime) * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Resolution By:</span>
                  <span className="font-semibold text-xs">
                    {new Date(Number(market.resolutionTime) * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="divider my-1"></div>
                {/* Current Phase */}
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60">Current Phase:</span>
                  <span className="font-semibold">
                    {market.status === 0 && !isBettingEnded && (
                      <span className="badge badge-success">Betting Open</span>
                    )}
                    {market.status === 0 && isBettingEnded && (
                      <span className="badge badge-warning">Awaiting Monitoring</span>
                    )}
                    {market.status === 1 && (
                      <span className="badge badge-warning">Monitoring</span>
                    )}
                    {market.status === 2 && (
                      <span className="badge badge-info">Resolved</span>
                    )}
                    {market.status === 3 && (
                      <span className="badge badge-error">Cancelled</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
