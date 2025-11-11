export interface InvoiceItem {
  description: string;
  rate: number;
  discount: number;
}

export interface InvoiceData {
  id?: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: InvoiceItem[];
  taxRate: number;
  notes: string;
  type: "invoice" | "proforma";
  createdAt?: string;
}
