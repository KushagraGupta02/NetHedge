import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export interface Bid {
  marketId: bigint;
  bidder: string;
  position: number; // 0=YES, 1=NO
  amount: bigint;
  timestamp: bigint;
  claimed: boolean;
}

export const useUserBids = (marketId: bigint | undefined) => {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getUserBids",
    args: marketId !== undefined && address ? [marketId, address] : undefined,
    query: {
      enabled: marketId !== undefined && !!address,
      refetchInterval: 10000,
    },
  });

  const bids = (data as Bid[]) || [];
  const totalBidAmount = bids.reduce((sum, bid) => sum + bid.amount, 0n);
  const hasBids = bids.length > 0;

  return {
    bids,
    totalBidAmount,
    hasBids,
    isLoading,
    error,
    refetch,
  };
};
