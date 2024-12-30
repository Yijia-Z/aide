import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

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

  try {
    // 从数据库里找这条记录
    console.log("Attempting to find userProfile by userId:", userId);
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      console.log("No userProfile found in DB. Possibly first-time user.");
      return NextResponse.json({ username: null });
    }

    console.log("Found userProfile:", profile);
    console.log("===[GET /api/user/profile] SUCCESS===");
    return NextResponse.json({ username: profile.username });
  } catch (err) {
    console.error("===[GET /api/user/profile] ERROR===", err);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
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
        create: { id: userId, username: finalUsername },
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
