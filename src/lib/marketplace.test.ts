import { describe, expect, it } from "vitest";
import { commissionForPrice } from "./marketplace";

describe("transport commission", () => {
  it("charges five percent in whole euro cents", () => {
    expect(commissionForPrice(10_000)).toBe(500);
    expect(commissionForPrice(3_299)).toBe(165);
    expect(commissionForPrice(1)).toBe(1);
  });
});

