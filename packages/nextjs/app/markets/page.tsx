"use client";

import Link from "next/link";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useMarket } from "~~/hooks/uptime";

const MarketCard = ({ marketId }: { marketId: bigint }) => {
  const { market, isLoading } = useMarket(marketId);

  if (isLoading || !market) {
    return (
      <div className="card bg-base-100 shadow-xl animate-pulse">
        <div className="card-body">
          <div className="h-6 bg-base-300 rounded w-3/4"></div>
          <div className="h-4 bg-base-300 rounded w-1/2 mt-2"></div>
        </div>
      </div>
    );
  }

  const statusNames = ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"];
  const statusColors = ["badge-success", "badge-warning", "badge-info", "badge-error"];

  const totalPool = market.yesPool + market.noPool;
  const yesPercentage = totalPool > 0n ? (Number(market.yesPool) * 100) / Number(totalPool) : 50;

  const timeRemaining = Number(market.endTime) * 1000 - Date.now();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

  return (
    <Link href={`/markets/${marketId}`}>
      <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <h2 className="card-title text-lg">{market.websiteUrl}</h2>
            <div className={`badge ${statusColors[market.status]}`}>{statusNames[market.status]}</div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">YES {yesPercentage.toFixed(0)}%</span>
              <span className="font-semibold">NO {(100 - yesPercentage).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-base-300 rounded-full h-3">
              <div
                className="bg-success h-3 rounded-full transition-all"
                style={{ width: `${yesPercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-xs text-base-content/60">Total Pool</div>
              <div className="font-bold">{(Number(totalPool) / 1e18).toFixed(2)} ETH</div>
            </div>
            <div>
              <div className="text-xs text-base-content/60">Time Left</div>
              <div className="font-bold">
                {market.status === 0 ? (hoursRemaining > 0 ? `${hoursRemaining}h` : "Ended") : "N/A"}
              </div>
            </div>
          </div>

          {market.status === 2 && (
            <div className="mt-2 text-center">
              <div className="badge badge-lg">
                {market.outcome ? "YES" : "NO"} WON - {Number(market.uptimePercentage) / 100}% uptime
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default function MarketsPage() {
  const { data: totalMarkets, isLoading } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getTotalMarkets",
  });

  const marketCount = Number(totalMarkets || 0n);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Uptime Markets</h1>
          <p className="text-base-content/60 mt-2">Bet on website uptime predictions</p>
        </div>
        <Link href="/markets/create" className="btn btn-primary">
          Create Market
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card bg-base-100 shadow-xl animate-pulse">
              <div className="card-body">
                <div className="h-6 bg-base-300 rounded w-3/4"></div>
                <div className="h-4 bg-base-300 rounded w-1/2 mt-2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : marketCount === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">No Markets Yet</h2>
          <p className="text-base-content/60 mb-6">Be the first to create an uptime prediction market!</p>
          <Link href="/markets/create" className="btn btn-primary">
            Create First Market
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: marketCount }, (_, i) => (
            <MarketCard key={i} marketId={BigInt(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
