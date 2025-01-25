// lib/prisma.ts (示例)
// 你想在这里检查某个环境变量的值
console.log("[ENV CHECK] aide_POSTGRES_URL =>", process.env.aider_POSTGRES_URL)

import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 同样也可以把其他你需要检查的环境变量打印出来
console.log("[ENV CHECK] NODE_ENV =>", process.env.NODE_ENV)
console.log("[ENV CHECK] DATABASE_URL =>", process.env.DATABASE_URL)
// ... 其他想检查的变量

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'], 
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

