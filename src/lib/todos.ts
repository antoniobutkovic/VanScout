import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema, sqlClient } from "./database";

export type Todo = { id: string; userId: string; title: string; done: boolean; createdAt: string; updatedAt: string };

function toTodo(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    done: Boolean(row.done),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listTodos(userId: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`SELECT id, user_id, title, done, created_at, updated_at FROM vanscout_todos WHERE user_id = ${userId} ORDER BY updated_at DESC, created_at DESC LIMIT 100`;
  return rows.map(row => toTodo(row as Record<string, unknown>));
}

export async function createTodo(userId: string, title: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`INSERT INTO vanscout_todos (id, user_id, title) VALUES (${randomUUID()}, ${userId}, ${title}) RETURNING id, user_id, title, done, created_at, updated_at`;
  return toTodo(rows[0] as Record<string, unknown>);
}

export async function updateTodo(userId: string, id: string, input: { title?: string; done?: boolean }) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`
    UPDATE vanscout_todos
    SET title = COALESCE(${input.title ?? null}, title), done = COALESCE(${input.done ?? null}, done), updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, title, done, created_at, updated_at
  `;
  if (!rows[0]) throw new Error("Todo not found");
  return toTodo(rows[0] as Record<string, unknown>);
}

export async function deleteTodo(userId: string, id: string) {
  await ensureDatabaseSchema();
  const sql = sqlClient();
  const rows = await sql`DELETE FROM vanscout_todos WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (!rows[0]) throw new Error("Todo not found");
}
