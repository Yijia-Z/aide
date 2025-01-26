import { ThreadOperation, OPERATION_MIN_RANK } from "./operation";
import { getUserRankForThread } from "./getUserRank";


export async function canDoThreadOperation(
    userId: string,
    threadId: string,
    operation: ThreadOperation
  ): Promise<boolean> {
    const userRank = await getUserRankForThread(userId, threadId);
    console.log("cando function: userrank ", userRank);
    const requiredRank = OPERATION_MIN_RANK[operation] || 999; // 若没定义就999
    console.log("cando function: reqrank ", requiredRank);

    if (userRank >= requiredRank) {
      return true;
    }
    return false;
  }
  