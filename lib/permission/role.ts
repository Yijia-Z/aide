// lib/roles.ts

// 对你的项目中的角色进行数字标记
export const ROLE_RANK: Record<string, number> = {
    VIEWER: 1,
    EDITOR: 2,
    OWNER: 3,
    // “creator”并不是 Prisma enum Role，而是 `thread.creatorId===userId` 时享有更高权力
    // 我们给它设4，以表示它高于 OWNER。
  };
  
  // 如果一个用户连 membership 都没有，可以当作 rank=0
  // 也可定义成: export const NO_MEMBERSHIP_RANK = 0;
  