import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from '@clerk/nextjs/server';

function generateRandomUsername(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return "user_" + result;
}

/**
 * GET /api/user/profile
 *  - 获取当前登录用户的 username
 */
export async function GET(req: NextRequest) {
  console.log("===[GET /api/user/profile] START===");
  
  // 获取auth信息
  const { userId } = await auth();
  console.log("UserID from Clerk auth:", userId);
  if (!userId) {
    console.log("No userId => not logged in. Returning 401...");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  //暂时需要。因为前面的user都没绑定邮箱所以现在需要对前面的user数据库进行更新。当这些user都有邮箱绑定后就可以删除这个部分。
  const user = await currentUser();
  const clerkEmail = user?.primaryEmailAddress?.emailAddress;
 

  try {
    // 查找 userProfile
    console.log("Attempting to find userProfile by userId:", userId);
    let profile = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      console.log("No userProfile found in DB => creating new row...");
      // 生成随机用户名（也可改成别的逻辑）
      const randomUsername = generateRandomUsername(8);
      // 创建一条新的记录
      profile = await prisma.userProfile.create({
        data: {
          id: userId,
          email: clerkEmail || null,
          username: randomUsername,
          // 如果有别的字段(如 balance)，可在此一起赋默认值
        },
      });
      console.log("Created new userProfile =>", profile);
    }

    // 如果 Clerk 拿到的邮箱不一致，就做一次更新（可选逻辑）
    if (clerkEmail && profile.email !== clerkEmail) {
      profile = await prisma.userProfile.update({
        where: { id: userId },
        data: {
          email: clerkEmail,
        },
      });
      console.log(`[GET /api/user/profile] Updated email =>`, profile);
    }

    console.log("Found or created userProfile:", profile);
    console.log("===[GET /api/user/profile] SUCCESS===");

    return NextResponse.json({
      username: profile.username,
      balance: profile.balance, // 如果有 balance 字段
    });
  } catch (err) {
    console.error("===[GET /api/user/profile] ERROR===", err);
    return NextResponse.json(
      { error: "Failed to fetch or create user profile" },
      { status: 500 }
    );
  }
}


/**
 * PUT /api/user/profile
 *  - 更新(或创建)当前登录用户的 username
 *  - 如果提交的 username 为空，则生成一个随机的
 */
export async function PUT(req: NextRequest) {
  console.log("===[PUT /api/user/profile] START===");

  const { userId } = await auth();
  console.log("UserID from Clerk auth:", userId);
  const user = await currentUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  if (!userId) {
    console.log("No userId => not logged in. Returning 401...");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: any;
  try {
    parsedBody = await req.json();
    console.log("Parsed request JSON:", parsedBody);
  } catch (jsonErr) {
    console.error("Error parsing JSON from request:", jsonErr);
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const { username } = parsedBody;
    console.log("username from client:", username);

    // 如果没传 username 或者是空字符串，就自动生成
    const finalUsername = username?.trim()
      ? username.trim()
      : generateRandomUsername(8);

    console.log("finalUsername to upsert:", finalUsername);

    // upsert：如果没有就 create，有就 update
    const upsertData = { 
        where: { id: userId },
        update: { username: finalUsername },
        create: { id: userId, username: finalUsername,email:userEmail, },
      };
      console.log("Upsert data:", upsertData);
      const profile = await prisma.userProfile.upsert(upsertData);
      console.log("Upsert result:", profile);

    console.log("===[PUT /api/user/profile] SUCCESS===");
    return NextResponse.json({ username: profile.username });
  } catch (err: any) {
  console.log("err?.name=", err?.name);
  console.log("err?.message=", err?.message);
  console.log("err?.stack=", err?.stack);
  return NextResponse.json({ error: "Failed to update" }, { status: 500 });
}
}
