import { InvoiceData } from "@/types/invoice";

const STORAGE_KEY = "invoices";

const envUrl = import.meta.env.VITE_INVOICE_API_URL;
const INVOICE_API_URL = typeof envUrl === "string" && envUrl.trim().length > 0 ? envUrl.trim() : undefined;
const isApiConfigured = Boolean(INVOICE_API_URL);

const buildApiUrl = (suffix = "") => {
  if (!INVOICE_API_URL) {
    return "";
  }

  const base = INVOICE_API_URL.endsWith("/") ? INVOICE_API_URL.slice(0, -1) : INVOICE_API_URL;
  return `${base}${suffix}`;
};

const parseInvoiceItems = (rawItems: unknown): InvoiceData["items"] => {
  if (Array.isArray(rawItems)) {
    return rawItems as InvoiceData["items"];
  }

  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) {
        return parsed as InvoiceData["items"];
      }
    } catch (error) {
      console.error("Failed to parse invoice items", error);
    }
  }

  return [];
};

const normaliseInvoice = (invoice: InvoiceData): InvoiceData => ({
  ...invoice,
  id: invoice.id || Date.now().toString(),
  createdAt: invoice.createdAt || new Date().toISOString(),
  type: invoice.type === "proforma" ? "proforma" : "invoice",
  items: parseInvoiceItems(invoice.items).map((item) => ({
    description: item?.description || "",
    rate:
      typeof item?.rate === "string"
        ? parseFloat(item.rate) || 0
        : typeof item?.rate === "number"
        ? item.rate
        : 0,
    discount:
      typeof item?.discount === "string"
        ? parseFloat(item.discount) || 0
        : typeof item?.discount === "number"
        ? item.discount
        : 0,
  })),
  taxRate:
    typeof invoice.taxRate === "string" ? parseFloat(invoice.taxRate) || 0 : invoice.taxRate || 0,
});

const readLocalInvoices = (): InvoiceData[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as InvoiceData[];
    return parsed.map(normaliseInvoice);
  } catch (error) {
    console.error("Failed to parse local invoices", error);
    return [];
  }
};

const writeLocalInvoices = (invoices: InvoiceData[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
};

const saveInvoiceLocally = (invoice: InvoiceData) => {
  const invoices = readLocalInvoices();
  const newInvoice = normaliseInvoice(invoice);
  const existingIndex = invoices.findIndex((inv) => inv.id === newInvoice.id);

  if (existingIndex >= 0) {
    invoices[existingIndex] = newInvoice;
  } else {
    invoices.push(newInvoice);
  }

  writeLocalInvoices(invoices);
  return newInvoice;
};

const deleteInvoiceLocally = (id: string) => {
  const invoices = readLocalInvoices();
  const filtered = invoices.filter((inv) => inv.id !== id);
  writeLocalInvoices(filtered);
};

export const saveInvoice = async (invoice: InvoiceData): Promise<InvoiceData> => {
  const preparedInvoice = normaliseInvoice(invoice);

  if (!isApiConfigured) {
    return saveInvoiceLocally(preparedInvoice);
  }

  try {
    const response = await fetch(buildApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preparedInvoice),
    });

    if (!response.ok) {
      throw new Error(`Failed to save invoice: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result?.success || !result?.invoice) {
      throw new Error(result?.message || "Invalid response while saving invoice");
    }

    const savedInvoice = normaliseInvoice(result.invoice || preparedInvoice);
    saveInvoiceLocally(savedInvoice);
    return savedInvoice;
  } catch (error) {
    console.error("Falling back to local invoice save", error);
    return saveInvoiceLocally(preparedInvoice);
  }
};

export const getInvoices = async (): Promise<InvoiceData[]> => {
  if (!isApiConfigured) {
    return readLocalInvoices();
  }

  try {
    const response = await fetch(buildApiUrl(), { method: "GET" });

    if (!response.ok) {
      throw new Error(`Failed to load invoices: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result?.success || !Array.isArray(result.invoices)) {
      throw new Error(result?.message || "Invalid response while loading invoices");
    }

    const normalised = result.invoices.map(normaliseInvoice);
    writeLocalInvoices(normalised);
    return normalised;
  } catch (error) {
    console.error("Falling back to local invoice load", error);
    return readLocalInvoices();
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  if (!isApiConfigured) {
    deleteInvoiceLocally(id);
    return;
  }

  try {
    const response = await fetch(buildApiUrl(`/${id}`), { method: "DELETE" });

    if (!response.ok) {
      throw new Error(`Failed to delete invoice: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result?.success) {
      throw new Error(result?.message || "Unknown error while deleting invoice");
    }

    deleteInvoiceLocally(id);
  } catch (error) {
    console.error("Falling back to local invoice delete", error);
    deleteInvoiceLocally(id);
  }
};
