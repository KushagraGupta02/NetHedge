import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const useOdds = (marketId: bigint | undefined) => {
  const { data, isLoading, error } = useScaffoldReadContract({
    contractName: "UptimeMarket",
    functionName: "getOdds",
    args: marketId !== undefined ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
      refetchInterval: 5000,
    },
  });

  const yesOdds = data ? Number(data[0]) / 10000 : 1;
  const noOdds = data ? Number(data[1]) / 10000 : 1;

  return {
    yesOdds,
    noOdds,
    isLoading,
    error,
  };
};
