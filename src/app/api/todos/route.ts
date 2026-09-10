import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { createTodo, listTodos } from "@/lib/todos";

const createSchema = z.object({ title: z.string().trim().min(1).max(200) });

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  return NextResponse.json({ ok: true, data: { todos: await listTodos(user.id) } });
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Title is required" } }, { status: 400 });
  return NextResponse.json({ ok: true, data: { todo: await createTodo(user.id, parsed.data.title) } });
}
