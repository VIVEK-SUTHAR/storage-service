import { createPublicClient, http } from "viem";
import { polygonAmoy, sepolia } from "viem/chains";

export const rpcClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});
