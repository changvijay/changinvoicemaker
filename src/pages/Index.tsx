import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Receipt, Users, Wallet, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import StatusBadge, { TypeBadge } from "@/components/StatusBadge";
import RemindersPanel from "@/components/RemindersPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/invoiceMath";

const Stat = ({ label, value, icon: Icon, tone, hint }: { label: string; value: string; icon: React.ElementType; tone: string; hint?: string }) => (
  <Card className="p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

const Index = () => {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const recent = useQuery({ queryKey: ["invoices", "recent"], queryFn: () => api.invoices({ limit: 8 }) });
  const company = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const s = stats.data;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {company.data?.name || "Chang IT Solutions"} — billing overview
          </p>
        </div>
      </div>

      {stats.error && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(stats.error as Error).message}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total invoiced" value={formatCurrency(s?.invoiced || 0)} icon={Wallet} tone="bg-primary/10 text-primary" hint={`${s?.invoiceCount ?? 0} tax invoices`} />
        <Stat label="Received" value={formatCurrency(s?.paid || 0)} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <Stat label="Outstanding" value={formatCurrency(s?.outstanding || 0)} icon={Clock} tone="bg-blue-50 text-blue-600" hint="Draft + sent" />
        <Stat label="Overdue" value={formatCurrency(s?.overdue || 0)} icon={AlertTriangle} tone="bg-amber-50 text-amber-600" hint="Sent and past due date" />
      </div>

      <div className="mt-6">
        <RemindersPanel />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Recent documents</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/documents">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {recent.data?.length ? (
            <ul className="divide-y">
              {recent.data.map((inv) => (
                <li key={inv.id}>
                  <Link to={`/documents/${inv.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{inv.invoiceNumber}</span>
                        <TypeBadge type={inv.type} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {inv.clientCompany || inv.clientName} · {formatDate(inv.date)}
                      </p>
                    </div>
                    <StatusBadge invoice={inv} />
                    <span className="w-28 text-right text-sm font-semibold tabular">{formatCurrency(inv.grandTotal || 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-14 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">{recent.isLoading ? "Loading…" : "No documents yet"}</p>
              {!recent.isLoading && <p className="text-sm text-muted-foreground">Create your first invoice to get started.</p>}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Link to="/invoice/new" className="block">
            <Card className="group overflow-hidden p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-brand-gradient p-3 text-white">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">New tax invoice</p>
                  <p className="text-xs text-muted-foreground">Bill for delivered work, with GST</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
          <Link to="/proforma/new" className="block">
            <Card className="group p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-accent/10 p-3 text-accent">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">New proforma</p>
                  <p className="text-xs text-muted-foreground">Quotation / advance request</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
          <Link to="/clients" className="block">
            <Card className="group p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-muted p-3 text-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{s?.clientCount ?? 0} clients</p>
                  <p className="text-xs text-muted-foreground">{s?.proformaCount ?? 0} proformas issued</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
