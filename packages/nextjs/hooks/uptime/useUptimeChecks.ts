import { useEffect, useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { UptimeCheck } from "./useMarket";

export const useUptimeChecks = (marketId: bigint | undefined) => {
  const [checks, setChecks] = useState<UptimeCheck[]>([]);

  const { data, isLoading, error, refetch } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getUptimeChecks",
    args: marketId !== undefined ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  useEffect(() => {
    if (data) {
      setChecks(data as UptimeCheck[]);
    }
  }, [data]);

  return {
    checks,
    isLoading,
    error,
    refetch,
  };
};
