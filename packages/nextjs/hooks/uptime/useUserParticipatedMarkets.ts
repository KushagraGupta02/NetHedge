import { useEffect, useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const useUserParticipatedMarkets = (address: string | undefined) => {
    const [marketIds, setMarketIds] = useState<bigint[]>([]);

    const { data, isLoading, error, refetch } = useScaffoldReadContract({
        contractName: "UptimeMarket",
        functionName: "getUserParticipatedMarkets",
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    useEffect(() => {
        if (data) {
            setMarketIds([...data]);
        }
    }, [data]);

    return {
        marketIds,
        isLoading,
        error,
        refetch,
    };
};
