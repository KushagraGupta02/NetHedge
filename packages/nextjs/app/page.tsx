"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ChartBarIcon, ClockIcon, TrophyIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  const { data: totalMarkets } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getTotalMarkets",
  });

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        {/* Hero Section */}
        <div className="px-5 text-center max-w-4xl">
          <h1 className="text-6xl font-bold mb-4">NetHedge</h1>
          <p className="text-2xl mb-2 text-base-content/80">Website Uptime Prediction Markets</p>
          <p className="text-lg text-base-content/60 mb-8">
            Bet on whether websites will stay online. Powered by decentralized oracles and smart contracts.
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <Link href="/markets" className="btn btn-primary btn-lg">
              Browse Markets
            </Link>
            <Link href="/markets/create" className="btn btn-outline btn-lg">
              Create Market
            </Link>
          </div>

          {/* Stats */}
          <div className="stats shadow mb-12">
            <div className="stat">
              <div className="stat-figure text-primary">
                <ChartBarIcon className="h-8 w-8" />
              </div>
              <div className="stat-title">Total Markets</div>
              <div className="stat-value text-primary">{totalMarkets?.toString() || "0"}</div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="flex justify-center items-center gap-8 flex-col md:flex-row max-w-6xl mx-auto">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <ChartBarIcon className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">1. Choose a Market</h3>
              <p className="text-base-content/70">
                Browse active uptime prediction markets for popular websites or create your own.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <ClockIcon className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">2. Place Your Bet</h3>
              <p className="text-base-content/70">
                Bet YES if you think the site will maintain 99%+ uptime, or NO if you think it will go down.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <TrophyIcon className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">3. Win Rewards</h3>
              <p className="text-base-content/70">
                When the market resolves, winners share the pool proportionally minus a 2% platform fee.
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-12 text-center">
            <h3 className="text-xl font-bold mb-4">Developer Tools</h3>
            <div className="flex gap-4 justify-center">
              <Link href="/debug" className="link link-primary">
                Debug Contracts
              </Link>
              <span>•</span>
              <Link href="/blockexplorer" className="link link-primary">
                Block Explorer
              </Link>
            </div>
          </div>
        </div>

        {/* CTA */}
        {!connectedAddress && (
          <div className="w-full bg-primary text-primary-content py-8 px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-2">Ready to Start?</h2>
              <p className="mb-4">Connect your wallet to participate in uptime prediction markets</p>
              <button className="btn btn-accent btn-lg">Connect Wallet</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
