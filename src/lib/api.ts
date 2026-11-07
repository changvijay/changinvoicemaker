import { Client, CompanySettings, DashboardStats, DocType, InvoiceData, InvoiceStatus, Reminders, Renewal, RenewalStatus } from "@/types/invoice";

// In development Vite proxies /api to the Express server (see vite.config.ts).
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new Error("Cannot reach the invoice server. Is `npm run server` running?");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  stats: () => request<{ stats: DashboardStats }>("/stats").then((r) => r.stats),

  settings: () => request<{ settings: CompanySettings }>("/settings").then((r) => r.settings),
  saveSettings: (s: CompanySettings) =>
    request<{ settings: CompanySettings }>("/settings", json("PUT", s)).then((r) => r.settings),

  clients: (q = "") =>
    request<{ clients: Client[] }>(`/clients?q=${encodeURIComponent(q)}`).then((r) => r.clients),
  createClient: (c: Partial<Client>) =>
    request<{ client: Client }>("/clients", json("POST", c)).then((r) => r.client),
  updateClient: (id: string, c: Partial<Client>) =>
    request<{ client: Client }>(`/clients/${id}`, json("PUT", c)).then((r) => r.client),
  deleteClient: (id: string) => request(`/clients/${id}`, json("DELETE")),

  invoices: (params: { type?: DocType | ""; status?: InvoiceStatus | ""; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return request<{ invoices: InvoiceData[] }>(`/invoices?${qs}`).then((r) => r.invoices);
  },
  invoice: (id: string) => request<{ invoice: InvoiceData }>(`/invoices/${id}`).then((r) => r.invoice),
  nextNumber: (type: DocType, date: string) =>
    request<{ invoiceNumber: string }>(`/invoices/next-number?type=${type}&date=${date}`).then((r) => r.invoiceNumber),
  saveInvoice: (inv: InvoiceData) =>
    request<{ invoice: InvoiceData }>(
      inv.id ? `/invoices/${inv.id}` : "/invoices",
      json(inv.id ? "PUT" : "POST", inv)
    ).then((r) => r.invoice),
  setStatus: (id: string, status: InvoiceStatus) =>
    request<{ invoice: InvoiceData }>(`/invoices/${id}/status`, json("PATCH", { status })).then((r) => r.invoice),
  duplicate: (id: string) =>
    request<{ invoice: InvoiceData }>(`/invoices/${id}/duplicate`, json("POST")).then((r) => r.invoice),
  convert: (id: string) =>
    request<{ invoice: InvoiceData }>(`/invoices/${id}/convert`, json("POST")).then((r) => r.invoice),
  deleteInvoice: (id: string) => request(`/invoices/${id}`, json("DELETE")),

  reminders: () => request<Reminders & { success: boolean }>("/reminders"),
  renewals: (params: { status?: RenewalStatus | ""; q?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return request<{ renewals: Renewal[] }>(`/renewals?${qs}`).then((r) => r.renewals);
  },
  renewal: (id: string) => request<{ renewal: Renewal }>(`/renewals/${id}`).then((r) => r.renewal),
  saveRenewal: (r: Renewal) =>
    request<{ renewal: Renewal }>(r.id ? `/renewals/${r.id}` : "/renewals", json(r.id ? "PUT" : "POST", r)).then((x) => x.renewal),
  deleteRenewal: (id: string) => request(`/renewals/${id}`, json("DELETE")),
  markRenewed: (id: string, data: { invoiceId?: string; note?: string } = {}) =>
    request<{ renewal: Renewal }>(`/renewals/${id}/renew`, json("POST", data)).then((r) => r.renewal),
  markReminded: (id: string) => request(`/renewals/${id}/reminded`, json("POST")),
};
