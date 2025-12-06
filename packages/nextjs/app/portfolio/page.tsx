"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useMarket, useUserBids, useUserParticipatedMarkets } from "~~/hooks/uptime";

const PortfolioRow = ({ marketId }: { marketId: bigint }) => {
    const { market } = useMarket(marketId);
    const { bids } = useUserBids(marketId);

    if (!market || !bids || bids.length === 0) return null;

    const totalInvested = bids.reduce((acc, bid) => acc + bid.amount, 0n);

    // Calculate P&L
    let winnings = 0n;
    let status = "Pending";
    let pnlClass = "text-base-content";

    if (market.status === 2) { // RESOLVED
        const userWon = bids.some(bid =>
            (market.outcome && bid.position === 0) || (!market.outcome && bid.position === 1)
        );

        if (userWon) {
            const winningPool = market.outcome ? market.yesPool : market.noPool;
            const totalPool = market.yesPool + market.noPool;

            const userWinningBets = bids.reduce((acc, bid) => {
                if ((market.outcome && bid.position === 0) || (!market.outcome && bid.position === 1)) {
                    return acc + bid.amount;
                }
                return acc;
            }, 0n);

            // Calculate gross winnings
            const grossWinnings = (userWinningBets * totalPool) / winningPool;
            // Deduct 2% fee
            const fee = (grossWinnings * 200n) / 10000n;
            winnings = grossWinnings - fee;

            status = "WON";
            pnlClass = "text-success";
        } else {
            status = "LOST";
            pnlClass = "text-error";
            winnings = 0n;
        }
    } else if (market.status === 3) { // CANCELLED
        status = "CANCELLED";
        winnings = totalInvested; // Refund
    } else {
        status = "OPEN/MONITORING";
    }

    const pnl = winnings > 0n ? winnings - totalInvested : (market.status === 2 ? -totalInvested : 0n);
    const pnlFormatted = market.status === 2 ? formatEther(pnl) : "--";

    return (
        <tr className="hover">
            <td>
                <a href={`/markets/${marketId}`} className="link link-hover font-bold">
                    {market.websiteUrl}
                </a>
                <div className="text-xs opacity-50">Market #{marketId.toString()}</div>
            </td>
            <td>
                <div className="flex gap-1">
                    {bids.map((bid, i) => (
                        <span key={i} className={`badge badge-xs ${bid.position === 0 ? "badge-success" : "badge-error"}`}>
                            {bid.position === 0 ? "YES" : "NO"}
                        </span>
                    ))}
                </div>
            </td>
            <td>{formatEther(totalInvested)} ETH</td>
            <td>
                <span className={`badge ${market.status === 0 ? "badge-success" :
                        market.status === 1 ? "badge-warning" :
                            market.status === 2 ? "badge-info" : "badge-error"
                    }`}>
                    {["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]}
                </span>
            </td>
            <td className="font-bold">{status}</td>
            <td className={`font-mono ${pnlClass}`}>
                {pnlFormatted !== "--" && pnl > 0n ? "+" : ""}{pnlFormatted} ETH
            </td>
        </tr>
    );
};

export default function PortfolioPage() {
    const { address } = useAccount();
    const { marketIds, isLoading } = useUserParticipatedMarkets(address);

    if (!address) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
        <p className="mb-4">Connect your wallet to view your portfolio.</p>
        {/* The ConnectButton is usually in the header, but we can guide them */}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Your Portfolio</h1>
      
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow-xl">
        <table className="table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Positions</th>
              <th>Invested</th>
              <th>Status</th>
              <th>Outcome</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {marketIds.length > 0 ? (
              marketIds.map((id) => (
                <PortfolioRow key={id.toString()} marketId={id} />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 opacity-50">
                  <div className="flex flex-col items-center gap-2">
                    <span>No bets placed yet.</span>
                    <a href="/markets" className="btn btn-primary btn-sm">Browse Markets</a>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
