import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { CompanySettings } from "@/types/invoice";

type Key = keyof CompanySettings;

const Section = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <Card className="grid gap-6 p-6 shadow-sm md:grid-cols-[14rem_1fr]">
    <div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </Card>
);

const Settings = () => {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await api.saveSettings(form);
      queryClient.setQueryData(["settings"], saved);
      setForm(saved);
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <AppLayout><p className="py-20 text-center text-sm text-destructive">{(error as Error).message}</p></AppLayout>;
  if (!form) return <AppLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;

  const set = (k: Key, v: string | number) => setForm((f) => f && { ...f, [k]: v });
  const input = (k: Key, label: string, props: React.ComponentProps<typeof Input> = {}, span = 1) => (
    <div className={`space-y-1.5 ${span === 2 ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      <Input
        value={String(form[k] ?? "")}
        onChange={(e) => set(k, props.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        {...props}
      />
    </div>
  );
  const area = (k: Key, label: string, rows = 3) => (
    <div className="space-y-1.5 sm:col-span-2">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} className="resize-none" value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );


  return (
    <AppLayout
      actions={
        <Button onClick={save} disabled={saving} className="bg-brand-gradient">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save settings
        </Button>
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">These details appear on every invoice you generate.</p>
      </div>

      <div className="space-y-6">
        <Section title="Company" hint="Your business identity on the invoice header.">
          {input("name", "Company name")}
          {input("tagline", "Tagline")}
          {area("address", "Registered address")}
          {input("state", "State")}
          {input("stateCode", "State code", { maxLength: 2 })}
          {input("email", "Email")}
          {input("phone", "Phone")}
          {input("website", "Website")}
          {input("logoUrl", "Logo URL")}
        </Section>

        <Section title="Tax registration" hint="Shown under your address. Leave blank if not registered.">
          {input("gstin", "GSTIN", { className: "font-mono uppercase", maxLength: 15 })}
          {input("pan", "PAN", { className: "font-mono uppercase", maxLength: 10 })}
        </Section>

        <Section title="Payment details" hint="Bank and UPI details printed at the bottom so clients can pay.">
          {input("bankAccountName", "Account name")}
          {input("bankName", "Bank name")}
          {input("bankAccountNumber", "Account number", { className: "font-mono" })}
          {input("bankIfsc", "IFSC", { className: "font-mono uppercase" })}
          {input("bankBranch", "Branch")}
          {input("upiId", "UPI ID", { className: "font-mono" })}
        </Section>

        <Section title="Defaults" hint="Used when you start a new invoice or proforma.">
          {input("invoicePrefix", "Invoice number prefix", { className: "font-mono" })}
          {input("proformaPrefix", "Proforma number prefix", { className: "font-mono" })}
          {input("defaultTaxRate", "Default GST rate (%)", { type: "number", min: 0, max: 100 })}
          {input("defaultDueDays", "Payment due in (days)", { type: "number", min: 0 })}
          {input("signatoryName", "Signatory name / title", {}, 2)}
          {area("defaultTerms", "Default terms & conditions", 4)}
        </Section>
      </div>
    </AppLayout>
  );
};

export default Settings;
