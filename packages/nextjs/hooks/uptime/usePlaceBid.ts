import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const usePlaceBid = () => {
  const { writeContractAsync, isPending } = useScaffoldWriteContract("UptimeMarket");

  const placeBid = async (marketId: bigint, position: 0 | 1, amount: bigint) => {
    try {
      const result = await writeContractAsync({
        functionName: "placeBid",
        args: [marketId, position],
        value: amount,
      });
      return result;
    } catch (error) {
      console.error("Error placing bid:", error);
      throw error;
    }
  };

  return {
    placeBid,
    isPending,
  };
};
