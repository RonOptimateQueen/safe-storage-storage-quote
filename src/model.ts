export const PER_CUBE_DISCLOSURE_THRESHOLD = 8;

export interface StorageQuoteInput {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  quoteDate: string;
  volumeCubicMeters: number;
  pricePerCubicMeter: number;
  movingPrice?: number;
  porteragePrice?: number;
}

export interface StorageQuoteCalculation {
  monthlyStoragePrice: number;
  showPricePerCubeLine: boolean;
  optionalServices: Array<{ label: string; amount: number }>;
}

export function calculateStorageQuote(input: StorageQuoteInput): StorageQuoteCalculation {
  const volume = nonNegative(input.volumeCubicMeters);
  const pricePerCube = nonNegative(input.pricePerCubicMeter);
  const optionalServices: Array<{ label: string; amount: number }> = [];

  addOptionalService(optionalServices, "מחיר ההובלה", input.movingPrice);
  addOptionalService(optionalServices, "מחיר הסבלות", input.porteragePrice);

  return {
    monthlyStoragePrice: roundCurrency(volume * pricePerCube),
    showPricePerCubeLine: volume >= PER_CUBE_DISCLOSURE_THRESHOLD,
    optionalServices,
  };
}

export function formatIls(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function addOptionalService(
  target: Array<{ label: string; amount: number }>,
  label: string,
  value: number | undefined,
): void {
  const amount = nonNegative(value ?? 0);
  if (amount > 0) target.push({ label, amount: roundCurrency(amount) });
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
