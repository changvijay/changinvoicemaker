import { BillingCycle, CompanySettings, InvoiceData, Renewal, RenewalCategory } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/lib/invoiceMath";

export const CATEGORY_LABELS: Record<RenewalCategory, string> = {
  domain: "Domain",
  hosting: "Hosting",
  ssl: "SSL certificate",
  amc: "AMC / support",
  software: "Software licence",
  email: "Email",
  cloud: "Cloud server",
  other: "Other",
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Every 6 months",
  yearly: "Yearly",
  two_yearly: "Every 2 years",
};

const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12, two_yearly: 24 };

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** The service period a renewal on `from` covers, e.g. 17 Nov 2026 – 16 Nov 2027. */
export const renewalPeriod = (from: string, cycle: BillingCycle) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + CYCLE_MONTHS[cycle]);
  end.setDate(end.getDate() - 1);
  return { from, to: toIso(end) };
};

/** The date one billing cycle after `from` — the default next renewal date for a recurring item. */
export const nextCycleDate = (from: string, cycle: BillingCycle) => {
  const d = new Date(`${from}T00:00:00`);
  d.setMonth(d.getMonth() + CYCLE_MONTHS[cycle]);
  return toIso(d);
};

export const dueLabel = (daysLeft = 0) => {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day${daysLeft === -1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `In ${daysLeft} days`;
};

export type Urgency = "overdue" | "soon" | "upcoming" | "later";

export const urgency = (daysLeft = 0, remindDays = 15): Urgency =>
  daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "soon" : daysLeft <= remindDays ? "upcoming" : "later";

export const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200",
  soon: "bg-amber-50 text-amber-800 ring-amber-200",
  upcoming: "bg-blue-50 text-blue-700 ring-blue-200",
  later: "bg-slate-100 text-slate-600 ring-slate-200",
};

// ---- Reminder messages (opened in the user's own email app / WhatsApp — nothing is sent automatically) ----

const whatsappNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits; // assume India for 10-digit numbers
};

export const renewalReminderText = (r: Renewal, company?: CompanySettings) => {
  const period = renewalPeriod(r.nextRenewalDate, r.billingCycle);
  return [
    `Dear ${r.clientName},`,
    "",
    `This is a friendly reminder that your ${CATEGORY_LABELS[r.category].toLowerCase()} "${r.serviceName}" is due for renewal on ${formatDate(r.nextRenewalDate)}.`,
    "",
    `Renewal period: ${formatDate(period.from)} to ${formatDate(period.to)}`,
    `Renewal amount: ${formatCurrency(r.amount)} (plus applicable GST)`,
    "",
    "Please confirm the renewal so that the service continues without interruption.",
    "",
    "Regards,",
    company?.name || "Chang IT Solutions",
    [company?.phone, company?.email].filter(Boolean).join(" | "),
  ].join("\n");
};

export const invoiceReminderText = (inv: InvoiceData & { daysLeft?: number }, company?: CompanySettings) =>
  [
    `Dear ${inv.clientName},`,
    "",
    (inv.daysLeft ?? 0) < 0
      ? `Our records show that invoice ${inv.invoiceNumber} for ${formatCurrency(inv.grandTotal || 0)} was due on ${formatDate(inv.dueDate)} and is still unpaid.`
      : `This is a reminder that invoice ${inv.invoiceNumber} for ${formatCurrency(inv.grandTotal || 0)} is due on ${formatDate(inv.dueDate)}.`,
    "",
    "Kindly arrange the payment at your earliest convenience. Please ignore this message if already paid.",
    "",
    "Regards,",
    company?.name || "Chang IT Solutions",
    [company?.phone, company?.email].filter(Boolean).join(" | "),
  ].join("\n");

export const mailtoLink = (email: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const whatsappLink = (phone: string, text: string) => {
  const n = whatsappNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "";
};
