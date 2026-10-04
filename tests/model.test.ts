import { describe, expect, it } from "vitest";
import { calculateStorageQuote } from "../src/model";

const base = {
  customerName: "לקוח בדיקה",
  quoteDate: "2026-10-04",
  volumeCubicMeters: 8,
  pricePerCubicMeter: 100,
};

describe("storage quote rules", () => {
  it("calculates monthly storage as volume times price per cube", () => {
    expect(calculateStorageQuote({ ...base, volumeCubicMeters: 8.5, pricePerCubicMeter: 97.25 }).monthlyStoragePrice).toBe(826.63);
  });

  it("shows the per-cube line at exactly 8 cubic meters", () => {
    expect(calculateStorageQuote(base).showPricePerCubeLine).toBe(true);
  });

  it("hides the per-cube line below 8 cubic meters", () => {
    expect(calculateStorageQuote({ ...base, volumeCubicMeters: 7.99 }).showPricePerCubeLine).toBe(false);
  });

  it("omits empty optional services", () => {
    expect(calculateStorageQuote({ ...base, movingPrice: 0 }).optionalServices).toEqual([]);
  });

  it("includes only optional services with a positive price", () => {
    expect(calculateStorageQuote({ ...base, movingPrice: 750, porteragePrice: undefined }).optionalServices).toEqual([
      { label: "מחיר ההובלה", amount: 750 },
    ]);
  });

  it("does not produce negative totals", () => {
    expect(calculateStorageQuote({ ...base, volumeCubicMeters: -5, pricePerCubicMeter: 100 }).monthlyStoragePrice).toBe(0);
  });
});
