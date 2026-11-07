export type DocType = "invoice" | "proforma";
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
export type TaxMode = "cgst_sgst" | "igst" | "none";

export interface InvoiceItem {
  description: string;
  hsnSac: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  /** Set when this line is a recurring service (domain, hosting, AMC…). */
  renewalCycle?: BillingCycle | null;
  nextRenewalDate?: string;
  renewalId?: string | null;
}

export interface InvoiceData {
  id?: string;
  type: DocType;
  invoiceNumber: string;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
  clientId?: string | null;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientGstin: string;
  placeOfSupply: string;
  taxMode: TaxMode;
  taxRate: number;
  items: InvoiceItem[];
  notes: string;
  terms: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  convertedFrom?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  state: string;
  createdAt?: string;
  invoiceCount?: number;
  totalBilled?: number;
}

export interface CompanySettings {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  state: string;
  stateCode: string;
  gstin: string;
  pan: string;
  logoUrl: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  invoicePrefix: string;
  proformaPrefix: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  defaultTerms: string;
  signatoryName: string;
}

export interface DashboardStats {
  invoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  proformaCount: number;
  clientCount: number;
}

export type RenewalCategory = "domain" | "hosting" | "ssl" | "amc" | "software" | "email" | "cloud" | "other";
export type BillingCycle = "monthly" | "quarterly" | "half_yearly" | "yearly" | "two_yearly";
export type RenewalStatus = "active" | "paused" | "cancelled";

export interface RenewalHistoryEntry {
  id: number;
  renewedOn: string;
  periodFrom: string;
  periodTo: string;
  amount: number;
  invoiceId: string | null;
  invoiceNumber: string;
  note: string;
}

export interface Renewal {
  id?: string;
  clientId?: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  category: RenewalCategory;
  description: string;
  hsnSac: string;
  amount: number;
  billingCycle: BillingCycle;
  startDate: string;
  nextRenewalDate: string;
  remindDaysBefore: number;
  status: RenewalStatus;
  notes: string;
  lastRenewedOn?: string;
  lastRemindedOn?: string;
  daysLeft?: number;
  history?: RenewalHistoryEntry[];
}

export interface Reminders {
  renewals: Renewal[];
  invoices: (InvoiceData & { daysLeft: number })[];
  next30Days: { count: number; amount: number };
}
