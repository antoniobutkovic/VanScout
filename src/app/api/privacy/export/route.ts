import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/request-auth";
import { exportUserData } from "@/lib/privacy";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await exportUserData(user);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="vanscout-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
