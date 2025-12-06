import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const useCloseMarket = () => {
  const { writeContractAsync, isPending } = useScaffoldWriteContract("UptimeMarket");

  const closeMarket = async (marketId: bigint) => {
    try {
      const result = await writeContractAsync({
        functionName: "closeMarket",
        args: [marketId],
      });
      return result;
    } catch (error) {
      console.error("Error closing market:", error);
      throw error;
    }
  };

  return {
    closeMarket,
    isPending,
  };
};
