import { redis } from "./redis";
import { rpcClient } from "./viem";
import { decodeEventLog, erc20Abi } from "viem";

export async function updateLeaderBoard(txnHash: string) {
  try {
    const receipt = await rpcClient.getTransactionReceipt({
      hash: txnHash as `0x${string}`,
    });

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [erc20Abi[1]],
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "Transfer") {
          const { to } = decoded.args;
          await updateLeaderBoardScore(to, 10);
          console.log(`Updated leaderboard for address ${to} by 10 points`);
        }
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.error("Error updating leaderboard:", e);
    throw e;
  }


async function updateLeaderBoardScore(address: string, points: number) {
  try {
    await redis.zincrby("leaderboard", points, address.toLowerCase());
  } catch (error) {
    console.error(`Error updating score for ${address}:`, error);
    throw error;
  }
}

export async function getLeaderBoard(limit: number = 10) {
  try {
    const results = await redis.zrange("leaderboard", 0, limit - 1, {
      rev: true,
      withScores: true,
    });

    return (results as { member: string; score: number }[]).map((item, i) => ({
      address: item.member,
      score: item.score,
      rank: i + 1,
    }));
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    throw error;
  }
}

export async function getAddressRank(address: string) {
  try {
    const rank = await redis.zrevrank("leaderboard", address.toLowerCase());
    const score = await redis.zscore("leaderboard", address.toLowerCase());

    return {
      address,
      rank: rank !== null ? rank + 1 : null,
      score: score ? Number(score) : 0,
    };
  } catch (error) {
    console.error(`Error getting rank for ${address}:`, error);
    throw error;
  }
}
