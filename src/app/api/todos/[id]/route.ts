import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUser } from "@/lib/request-auth";
import { deleteTodo, updateTodo } from "@/lib/todos";

const updateSchema = z.object({ title: z.string().trim().min(1).max(200).optional(), done: z.boolean().optional() }).refine(value => value.title !== undefined || value.done !== undefined);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Invalid todo update" } }, { status: 400 });
  try {
    const { id } = await context.params;
    return NextResponse.json({ ok: true, data: { todo: await updateTodo(user.id, id, parsed.data) } });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Todo not found" } }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  try {
    const { id } = await context.params;
    await deleteTodo(user.id, id);
    return NextResponse.json({ ok: true, data: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Todo not found" } }, { status: 404 });
  }
}
