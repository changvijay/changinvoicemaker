import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, RefreshCw } from "lucide-react";
import { BillingCycle, Client, InvoiceData, InvoiceItem, TaxMode } from "@/types/invoice";
import { computeTotals, formatAmount, formatCurrency, formatDate, lineAmount } from "@/lib/invoiceMath";
import { CYCLE_LABELS, nextCycleDate } from "@/lib/renewals";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
  clients: Client[];
  companyState: string;
}

const emptyItem = (): InvoiceItem => ({ description: "", hsnSac: "", quantity: 1, unitPrice: 0, discountPct: 0 });

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <Card className="p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
      {action}
    </div>
    {children}
  </Card>
);

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs font-medium text-foreground/80">{label}</Label>
    {children}
  </div>
);

const toNumber = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const InvoiceForm = ({ data, onChange, clients, companyState }: InvoiceFormProps) => {
  const set = <K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) => onChange({ ...data, [field]: value });

  const updateItem = (index: number, patch: Partial<InvoiceItem>) => {
    const items = data.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...data, items });
  };

  const setRenewal = (index: number, cycle: BillingCycle | null) =>
    updateItem(index, cycle ? { renewalCycle: cycle, nextRenewalDate: nextCycleDate(data.date, cycle) } : { renewalCycle: null, nextRenewalDate: "", renewalId: null });

  /** Changing the issue date also moves renewal dates that were still on their default (issue date + cycle). */
  const setIssueDate = (date: string) => {
    const items = data.items.map((i) =>
      i.renewalCycle && date && i.nextRenewalDate === nextCycleDate(data.date, i.renewalCycle)
        ? { ...i, nextRenewalDate: nextCycleDate(date, i.renewalCycle) }
        : i
    );
    onChange({ ...data, date, items });
  };

  const removeItem = (index: number) =>
    onChange({ ...data, items: data.items.length > 1 ? data.items.filter((_, i) => i !== index) : [emptyItem()] });

  const pickClient = (id: string) => {
    if (id === "__new") {
      onChange({ ...data, clientId: null, clientName: "", clientCompany: "", clientEmail: "", clientPhone: "", clientAddress: "", clientGstin: "", placeOfSupply: "" });
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    const state = c.state || data.placeOfSupply;
    onChange({
      ...data,
      clientId: c.id,
      clientName: c.name,
      clientCompany: c.company,
      clientEmail: c.email,
      clientPhone: c.phone,
      clientAddress: c.address,
      clientGstin: c.gstin,
      placeOfSupply: state,
      taxMode:
        data.taxMode === "none" || !state || !companyState
          ? data.taxMode
          : state.trim().toLowerCase() === companyState.trim().toLowerCase()
            ? "cgst_sgst"
            : "igst",
    });
  };

  const totals = computeTotals(data);
  const isProforma = data.type === "proforma";

  return (
    <div className="space-y-4">
      <Section title="Document">
        <div className="grid grid-cols-2 gap-3">
          <Field label={isProforma ? "Proforma number" : "Invoice number"} className="col-span-2">
            <Input
              value={data.invoiceNumber}
              onChange={(e) => set("invoiceNumber", e.target.value)}
              placeholder="Assigned automatically on first save"
              className="font-mono"
            />
          </Field>
          <Field label="Issue date">
            <Input type="date" value={data.date} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label={isProforma ? "Valid until" : "Due date"}>
            <Input type="date" value={data.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Bill to">
        <div className="grid grid-cols-2 gap-3">
          {clients.length > 0 && (
            <Field label="Saved client" className="col-span-2">
              <Select value={data.clientId || ""} onValueChange={pickClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a saved client or type new details below" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new">+ New client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Contact name *">
            <Input value={data.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Company">
            <Input value={data.clientCompany} onChange={(e) => set("clientCompany", e.target.value)} placeholder="Business name" />
          </Field>
          <Field label="Email">
            <Input type="email" value={data.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="client@company.com" />
          </Field>
          <Field label="Phone">
            <Input value={data.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="+91" />
          </Field>
          <Field label="Billing address" className="col-span-2">
            <Textarea rows={3} className="resize-none" value={data.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} placeholder="Street, city, state, PIN" />
          </Field>
          <Field label="Client GSTIN">
            <Input className="font-mono uppercase" maxLength={15} value={data.clientGstin} onChange={(e) => set("clientGstin", e.target.value.toUpperCase())} placeholder="33ABCDE1234F1Z5" />
          </Field>
          <Field label="Place of supply (state)">
            <Input value={data.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)} placeholder={companyState || "Tamil Nadu"} />
          </Field>
        </div>
      </Section>

      <Section
        title={`Line items (${data.items.length})`}
        action={
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => set("items", [...data.items, emptyItem()])}>
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        }
      >
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div key={index} className="group rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                <div className="grid flex-1 grid-cols-12 gap-2">
                  <Textarea
                    rows={2}
                    className="col-span-12 resize-none bg-background"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={`Item ${index + 1} — service or product description`}
                  />
                  <Field label="Rate (₹)" className="col-span-5">
                    <Input type="number" min="0" step="0.01" className="h-9 bg-background tabular" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: toNumber(e.target.value) })} />
                  </Field>
                  <Field label="Qty" className="col-span-3">
                    <Input type="number" min="0" step="1" className="h-9 bg-background tabular" value={item.quantity} onChange={(e) => updateItem(index, { quantity: toNumber(e.target.value) })} />
                  </Field>
                  <Field label="Disc %" className="col-span-4">
                    <Input type="number" min="0" max="100" step="0.5" className="h-9 bg-background tabular" value={item.discountPct} onChange={(e) => updateItem(index, { discountPct: Math.min(100, toNumber(e.target.value)) })} />
                  </Field>
                  <Field label="HSN/SAC" className="col-span-6">
                    <Input className="h-9 bg-background font-mono text-xs" value={item.hsnSac} onChange={(e) => updateItem(index, { hsnSac: e.target.value })} placeholder="998314" />
                  </Field>
                  <div className="col-span-6 flex flex-col items-end justify-end pb-1.5 text-right">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</span>
                    <span className="text-sm font-semibold tabular">{formatAmount(lineAmount(item))}</span>
                  </div>

                  <div className={`col-span-12 mt-1 rounded-md border p-2.5 ${item.renewalCycle ? "border-primary/30 bg-primary/5" : "border-dashed bg-background/60"}`}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <Switch checked={!!item.renewalCycle} onCheckedChange={(on) => setRenewal(index, on ? "yearly" : null)} />
                      <RefreshCw className={`h-3.5 w-3.5 ${item.renewalCycle ? "text-primary" : "text-muted-foreground"}`} />
                      Recurring service (domain, hosting, AMC…) — remind me to renew
                    </label>
                    {item.renewalCycle && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <Field label="Renews">
                          <Select value={item.renewalCycle} onValueChange={(v) => setRenewal(index, v as BillingCycle)}>
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CYCLE_LABELS).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Next renewal date">
                          <Input type="date" className="h-9 bg-background" value={item.nextRenewalDate || ""} onChange={(e) => updateItem(index, { nextRenewalDate: e.target.value })} />
                        </Field>
                        <p className="col-span-2 text-[11px] text-muted-foreground">
                          {data.type === "proforma"
                            ? "Shown on the proforma. The renewal reminder starts when it becomes a tax invoice."
                            : item.renewalId
                              ? `Linked to an existing renewal — saving updates it to ${formatDate(item.nextRenewalDate)}.`
                              : "Saving adds this to Renewals and reminds you 15 days before."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tax">
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST type">
            <Select value={data.taxMode} onValueChange={(v) => set("taxMode", v as TaxMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cgst_sgst">CGST + SGST (same state)</SelectItem>
                <SelectItem value="igst">IGST (other state)</SelectItem>
                <SelectItem value="none">No tax</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="GST rate (%)">
            <Select value={String(data.taxRate)} onValueChange={(v) => set("taxRate", toNumber(v))} disabled={data.taxMode === "none"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 12, 18, 28].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}%
                  </SelectItem>
                ))}
                {![0, 5, 12, 18, 28].includes(data.taxRate) && <SelectItem value={String(data.taxRate)}>{data.taxRate}%</SelectItem>}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4 space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable value</span>
            <span className="tabular">{formatCurrency(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>GST</span>
            <span className="tabular">{formatCurrency(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular">{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </Section>

      <Section title="Terms & notes">
        <div className="space-y-3">
          <Field label="Terms & conditions">
            <Textarea rows={4} className="resize-none text-sm" value={data.terms} onChange={(e) => set("terms", e.target.value)} />
          </Field>
          <Field label="Notes to client">
            <Textarea rows={2} className="resize-none text-sm" value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Project: CRM implementation, Phase 1" />
          </Field>
        </div>
      </Section>
    </div>
  );
};

export default InvoiceForm;
