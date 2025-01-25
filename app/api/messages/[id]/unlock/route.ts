// /app/api/messages/[id]/unlock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { canDoThreadOperation, ThreadOperation } from "@/lib/permission";

export async function PATCH(req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
   
const { userId } = await auth();
if (!userId) {
 
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
try{
  const { id: messageId } = await params;
 
  const result = await prisma.message.updateMany({
    where: {
      id: messageId,
     
        editingBy: userId,

    },
    data: {
      editingBy: null,
      editingAt: null,
    },
  });

   

  return NextResponse.json({ ok: true });
} catch (err: any) {
  console.error("Lock message failed:", err);
  return NextResponse.json({ error: err.message }, { status: 500 });
}
}