import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
/**
 * GET /api/userProfiles/:id
 *   - 获取指定用户的 balance （以及其他字段，比如 username）
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }  
  ) {
    try {
    const { id: userIdParam } = await params;
    
    console.log("GET /api/userProfiles/[id] => id =", userIdParam);

    // 例如，如果要确保只能查自己的信息：
    // if (userIdParam !== clerkUserId) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // 从数据库中查找 userProfile
    const profile = await prisma.userProfile.findUnique({
      where: { id: userIdParam },
    });

    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // balance 是 Decimal 类型，需要转换成字符串或数字
    const balanceStr = profile.balance.toString();

    return NextResponse.json({
      id: profile.id,
      username: profile.username,
      balance: balanceStr, 
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt

    });
  } catch (err) {
    console.error("Error in GET /api/userProfiles/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }  
  ) {
    try {
    const { id: userIdParam } = await params;
    
    console.log("GET /api/userProfiles/[id] => id =", userIdParam);

      const body = await request.json();
      const { username } = body;
  
      // 如果传了 username，就更新
      const dataToUpdate: any = {};
      if (username !== undefined) {
        dataToUpdate.username = username.trim();
      }
  
      const updated = await prisma.userProfile.update({
        where: { id: userIdParam },
        data: dataToUpdate,
      });
  
      // 返回更新后的资料
      return NextResponse.json({
        id: updated.id,
        username: updated.username,
        balance: updated.balance.toString(), // 仍只读
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      console.error("Error in PUT /api/userProfiles/[id]:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }