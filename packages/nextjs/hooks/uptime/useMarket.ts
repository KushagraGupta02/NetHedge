import { useEffect, useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export interface Market {
  id: bigint;
  websiteUrl: string;
  startTime: bigint;
  bettingEndTime: bigint;
  monitoringEndTime: bigint;
  resolutionTime: bigint;
  yesPool: bigint;
  noPool: bigint;
  status: number; // 0=OPEN, 1=MONITORING, 2=RESOLVED, 3=CANCELLED
  outcome: boolean;
  uptimePercentage: bigint;
  totalBids: bigint;
  creator: string;
}

export interface UptimeCheck {
  timestamp: bigint;
  isUp: boolean;
  responseTime: bigint;
}

export const useMarket = (marketId: bigint | undefined) => {
  const [market, setMarket] = useState<Market | null>(null);

  const { data, isLoading, error, refetch } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getMarket",
    args: marketId !== undefined ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  useEffect(() => {
    if (data) {
      setMarket(data as Market);
    }
  }, [data]);

  return {
    market,
    isLoading,
    error,
    refetch,
  };
};
