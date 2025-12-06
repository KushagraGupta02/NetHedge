import { useEffect, useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { Market } from "./useMarket";

export const useAllMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);

  // Get total number of markets
  const { data: totalMarkets, isLoading: isLoadingTotal } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getTotalMarkets",
    query: {
      refetchInterval: 10000,
    },
  });

  // Fetch all markets
  useEffect(() => {
    const fetchAllMarkets = async () => {
      if (!totalMarkets || totalMarkets === 0n) {
        setMarkets([]);
        return;
      }

      const marketPromises = [];
      for (let i = 0n; i < totalMarkets; i++) {
        marketPromises.push(
          fetch(`/api/market/${i}`)
            .then(res => res.json())
            .catch(() => null),
        );
      }

      // For now, we'll use a simple approach
      // In production, you'd want to use The Graph or event indexing
      const marketIds = Array.from({ length: Number(totalMarkets) }, (_, i) => BigInt(i));
      setMarkets(
        marketIds.map(id => ({
          id,
          websiteUrl: "",
          startTime: 0n,
          endTime: 0n,
          resolutionTime: 0n,
          yesPool: 0n,
          noPool: 0n,
          status: 0,
          outcome: false,
          uptimePercentage: 0n,
          totalBids: 0n,
          creator: "",
        })),
      );
    };

    fetchAllMarkets();
  }, [totalMarkets]);

  return {
    markets,
    totalMarkets: totalMarkets || 0n,
    isLoading: isLoadingTotal,
  };
};
