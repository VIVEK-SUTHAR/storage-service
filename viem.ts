import { createPublicClient, http } from "viem";
import { polygonAmoy } from "viem/chains";

export const rpcClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});
