import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const useClaimWinnings = () => {
  const { writeContractAsync, isPending } = useScaffoldWriteContract("UptimeMarket");

  const claimWinnings = async (marketId: bigint) => {
    try {
      const result = await writeContractAsync({
        functionName: "claimWinnings",
        args: [marketId],
      });
      return result;
    } catch (error) {
      console.error("Error claiming winnings:", error);
      throw error;
    }
  };

  return {
    claimWinnings,
    isPending,
  };
};
