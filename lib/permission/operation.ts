// lib/permission/operation.ts (继续写在同文件里)
export enum ThreadOperation {
    EDIT_TITLE = "EDIT_TITLE",
    DELETE_THREAD = "DELETE_THREAD",
    INVITE_MEMBER = "INVITE_MEMBER",
    KICK_MEMBER = "KICK_MEMBER",
    EDIT_MESSAGE = "EDIT_MESSAGE",
    SEND_MESSAGE = "SEND_MESSAGE",
    DELETE_MESSAGE = "DELETE_MESSAGE",
    VIEW_MESSAGE = "VIEW_MESSAGE",
    QUIT_THREAD = "QUIT_THREAD", 
    // ...
  }
  
  // 需要多少级权限才可以执行
  export const OPERATION_MIN_RANK: Record<ThreadOperation, number> = {
    [ThreadOperation.EDIT_TITLE]: 4,       // 只有 rank=4(creator) 可以改标题
    [ThreadOperation.DELETE_THREAD]: 4,    // 只有 creator 能删除
    [ThreadOperation.INVITE_MEMBER]: 3,    // OWNER(3) 或 CREATOR(4) 都能
    [ThreadOperation.KICK_MEMBER]: 3,      // OWNER(3)/CREATOR(4)
    [ThreadOperation.EDIT_MESSAGE]: 2, 
    [ThreadOperation.SEND_MESSAGE]: 2,   
    [ThreadOperation.DELETE_MESSAGE]: 2,    // EDITOR(2)/OWNER(3)/CREATOR(4) 都行
    [ThreadOperation.VIEW_MESSAGE]: 1,     // VIEWER(1)+ 都行
    [ThreadOperation.QUIT_THREAD]: 1, 
    // ...
  };
  