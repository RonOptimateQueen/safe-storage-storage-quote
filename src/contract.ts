import { calculateStorageQuote, type StorageQuoteInput } from "./model";

export const STORAGE_QUOTE_TYPE = 3;

export interface StorageQuoteSubmission {
  customerId: string;
  contactId?: string;
  ownerId: string;
  quote: StorageQuoteInput;
}

export interface StorageQuoteClientSubmission {
  token: string;
  clientSubmissionId: string;
  form: StorageQuoteInput;
}

export interface FireberryStorageQuotePlan {
  quote: {
    accountid: string;
    contacttid?: string;
    ownerid: string;
    pcfquotetype: typeof STORAGE_QUOTE_TYPE;
    pcfquotestatus: 1;
    pcfformpayload: string;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    kind: "storage" | "moving" | "porterage";
  }>;
  delivery: {
    signatureRequired: false;
  };
}

export function buildFireberryStorageQuotePlan(submission: StorageQuoteSubmission): FireberryStorageQuotePlan {
  const calculation = calculateStorageQuote(submission.quote);
  const lines: FireberryStorageQuotePlan["lines"] = [
    {
      description: "אחסנה חודשית",
      quantity: submission.quote.volumeCubicMeters,
      unitPrice: submission.quote.pricePerCubicMeter,
      amount: calculation.monthlyStoragePrice,
      kind: "storage",
    },
  ];

  for (const service of calculation.optionalServices) {
    lines.push({
      description: service.label,
      quantity: 1,
      unitPrice: service.amount,
      amount: service.amount,
      kind: service.label === "מחיר ההובלה" ? "moving" : "porterage",
    });
  }

  return {
    quote: {
      accountid: submission.customerId,
      ...(submission.contactId ? { contacttid: submission.contactId } : {}),
      ownerid: submission.ownerId,
      pcfquotetype: STORAGE_QUOTE_TYPE,
      pcfquotestatus: 1,
      pcfformpayload: JSON.stringify(submission.quote),
    },
    lines,
    delivery: { signatureRequired: false },
  };
}
