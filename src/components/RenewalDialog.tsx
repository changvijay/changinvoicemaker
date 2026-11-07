import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { addDays, todayIso } from "@/lib/invoiceMath";
import { CATEGORY_LABELS, CYCLE_LABELS } from "@/lib/renewals";
import { BillingCycle, Renewal, RenewalCategory, RenewalStatus } from "@/types/invoice";

export const blankRenewal = (): Renewal => ({
  clientId: null,
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  serviceName: "",
  category: "domain",
  description: "",
  hsnSac: "998315",
  amount: 0,
  billingCycle: "yearly",
  startDate: todayIso(),
  nextRenewalDate: addDays(todayIso(), 365),
  remindDaysBefore: 15,
  status: "active",
  notes: "",
});

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

interface Props {
  renewal: Renewal | null;
  onClose: () => void;
  onSaved: (r: Renewal) => void;
}

const RenewalDialog = ({ renewal, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<Renewal | null>(renewal);
  const [saving, setSaving] = useState(false);
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => api.clients(), enabled: !!renewal });

  useEffect(() => setForm(renewal), [renewal]);

  if (!form) return null;
  const set = <K extends keyof Renewal>(k: K, v: Renewal[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (c) setForm((f) => f && { ...f, clientId: c.id, clientName: c.company || c.name, clientEmail: c.email, clientPhone: c.phone });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveRenewal(form);
      toast.success(`${saved.serviceName} saved`);
      onSaved(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!renewal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit renewal" : "Add renewal"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {clients.length > 0 && (
            <Field label="Saved client" className="col-span-2">
              <Select value={form.clientId || ""} onValueChange={pickClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client, or type the details below" />
                </SelectTrigger>
                <SelectContent>
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
          <Field label="Client name *">
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value, clientId: null })} />
          </Field>
          <Field label="Client email">
            <Input type="email" value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
          </Field>
          <Field label="Client phone / WhatsApp">
            <Input value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="+91" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => set("category", v as RenewalCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Service name *" className="col-span-2">
            <Input value={form.serviceName} onChange={(e) => set("serviceName", e.target.value)} placeholder="e.g. srilakshmitraders.in domain, CRM AMC, VPS hosting" />
          </Field>
          <Field label="Description (shown on the invoice)" className="col-span-2">
            <Textarea rows={2} className="resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <Field label="Renewal amount (₹, before GST)">
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Billing cycle">
            <Select value={form.billingCycle} onValueChange={(v) => set("billingCycle", v as BillingCycle)}>
              <SelectTrigger>
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
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Next renewal date *">
            <Input type="date" value={form.nextRenewalDate} onChange={(e) => set("nextRenewalDate", e.target.value)} />
          </Field>
          <Field label="Remind me (days before)">
            <Input type="number" min="0" max="365" value={form.remindDaysBefore} onChange={(e) => set("remindDaysBefore", parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="HSN/SAC">
            <Input className="font-mono" value={form.hsnSac} onChange={(e) => set("hsnSac", e.target.value)} />
          </Field>
          {form.id && (
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v as RenewalStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused (no reminders)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Internal notes" className="col-span-2">
            <Textarea rows={2} className="resize-none" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Registrar, login hints, vendor cost…" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save renewal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenewalDialog;
