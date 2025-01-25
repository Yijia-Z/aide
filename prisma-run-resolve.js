// prisma-run-resolve.js
const { execSync } = require('child_process');

// 1. 在执行 prisma 命令前，先打印我们关心的环境变量
console.log('--- ENV BEFORE PRISMA MIGRATE RESOLVE COMMAND ---');
console.log('DATABASE_URL=', process.env.DATABASE_URL);

// 2. 执行 prisma migrate resolve 命令
console.log('--- RUNNING PRISMA MIGRATE RESOLVE COMMAND ---');
try {
  execSync('npx prisma migrate resolve --applied 20250126_baseline', { stdio: 'inherit' });
  // 这里的 "20250126_baseline" 要替换成你实际的迁移文件夹名
} catch (err) {
  console.error('Error during migrate resolve:', err.message);
}

// 3. 命令执行完后，再次打印环境变量
console.log('--- ENV AFTER PRISMA MIGRATE RESOLVE COMMAND ---');
console.log('DATABASE_URL=', process.env.DATABASE_URL);
