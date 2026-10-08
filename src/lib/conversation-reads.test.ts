import { beforeEach, describe, expect, it, vi } from "vitest";

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("./database", () => ({ ensureDatabaseSchema: vi.fn(), sqlClient: () => sql }));
vi.mock("./message-crypto", () => ({ decryptMessage: (body: string) => body, encryptMessage: (body: string) => body }));

import { listMessages } from "./marketplace";

const exactTimestamp = "2026-10-06 18:00:00.123456+00";
const message = {
  id: "message-1", sender_id: "sender-1", sender_name: "Sender", body: "Hello",
  created_at: new Date("2026-10-06T18:00:00.123Z"), read_through: exactTimestamp,
};

beforeEach(() => sql.mockReset());

describe("conversation read tracking", () => {
  it("saves the exact database timestamp rather than the driver's truncated Date", async () => {
    sql.mockResolvedValueOnce([{ id: "offer-1" }]).mockResolvedValueOnce([message]).mockResolvedValueOnce([]);

    const messages = await listMessages("offer-1", "user-1", true);

    expect(messages?.[0].body).toBe("Hello");
    expect(sql.mock.calls[1][0].join("")).toContain("message.created_at::text AS read_through");
    expect(sql.mock.calls[2].slice(1)).toEqual(["offer-1", "user-1", exactTimestamp]);
  });

  it("does not save read state when loading a hidden conversation", async () => {
    sql.mockResolvedValueOnce([{ id: "offer-1" }]).mockResolvedValueOnce([message]);

    await listMessages("offer-1", "user-1", false);

    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("does not read or mark a conversation the user cannot access", async () => {
    sql.mockResolvedValueOnce([]);

    expect(await listMessages("offer-1", "user-1", true)).toBeNull();
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
