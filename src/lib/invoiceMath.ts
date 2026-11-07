import { InvoiceData, InvoiceItem } from "@/types/invoice";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineAmount = (item: InvoiceItem) => {
  const gross = (item.quantity || 0) * (item.unitPrice || 0);
  return round2(gross - (gross * (item.discountPct || 0)) / 100);
};

/** Same maths as server/invoiceServer.mjs computeTotals — keep them in sync. */
export const computeTotals = (data: Pick<InvoiceData, "items" | "taxMode" | "taxRate">) => {
  let subtotal = 0;
  let discountTotal = 0;
  for (const item of data.items) {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    subtotal += gross;
    discountTotal += (gross * (item.discountPct || 0)) / 100;
  }
  const taxable = subtotal - discountTotal;
  const taxTotal = data.taxMode === "none" ? 0 : (taxable * (data.taxRate || 0)) / 100;
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxable: round2(taxable),
    taxTotal: round2(taxTotal),
    halfTax: round2(taxTotal / 2),
    grandTotal: round2(taxable + taxTotal),
  };
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCurrency = (n: number) => inr.format(n || 0);
export const formatAmount = (n: number) => plain.format(n || 0);

export const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const isOverdue = (inv: Pick<InvoiceData, "status" | "dueDate" | "type">) =>
  inv.type === "invoice" && inv.status === "sent" && !!inv.dueDate && inv.dueDate < todayIso();

// ---- Amount in words (Indian numbering: thousand, lakh, crore) ----

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const twoDigits = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const threeDigits = (n: number) => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
};

const integerToWords = (n: number): string => {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
};

export const amountInWords = (amount: number) => {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const words = `Indian Rupees ${integerToWords(rupees)}`;
  return paise ? `${words} and ${twoDigits(paise)} Paise Only` : `${words} Only`;
};
