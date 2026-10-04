import { describe, expect, it } from "vitest";
import { buildFireberryStorageQuotePlan } from "../src/contract";

describe("Fireberry storage quote plan", () => {
  it("maps storage to quote type 3 and one monthly storage line", () => {
    const result = buildFireberryStorageQuotePlan({
      customerId: "account-1",
      ownerId: "owner-1",
      quote: {
        customerName: "לקוח",
        quoteDate: "2026-10-04",
        volumeCubicMeters: 10,
        pricePerCubicMeter: 90,
      },
    });

    expect(result.quote.pcfquotetype).toBe(3);
    expect(result.quote.pcfquotestatus).toBe(1);
    expect(result.lines).toEqual([
      { description: "אחסנה חודשית", quantity: 10, unitPrice: 90, amount: 900, kind: "storage" },
    ]);
    expect(result.delivery.signatureRequired).toBe(false);
  });

  it("adds only priced optional services as separate quote lines", () => {
    const result = buildFireberryStorageQuotePlan({
      customerId: "account-1",
      contactId: "contact-1",
      ownerId: "owner-1",
      quote: {
        customerName: "לקוח",
        quoteDate: "2026-10-04",
        volumeCubicMeters: 6,
        pricePerCubicMeter: 120,
        movingPrice: 500,
        porteragePrice: 0,
      },
    });

    expect(result.quote.contacttid).toBe("contact-1");
    expect(result.lines.map((line) => line.kind)).toEqual(["storage", "moving"]);
  });
});
