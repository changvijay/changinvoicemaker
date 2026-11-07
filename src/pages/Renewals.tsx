import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronRight, FilePlus2, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import RenewalDialog, { blankRenewal } from "@/components/RenewalDialog";
import ReminderButton from "@/components/ReminderButton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/invoiceMath";
import { CATEGORY_LABELS, CYCLE_LABELS, URGENCY_STYLES, dueLabel, renewalReminderText, urgency } from "@/lib/renewals";
import { cn } from "@/lib/utils";
import { Renewal, RenewalStatus } from "@/types/invoice";

const FILTERS: { key: RenewalStatus | "due"; label: string }[] = [
  { key: "due", label: "Due soon" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "cancelled", label: "Cancelled" },
];

const YEARLY_FACTOR = { monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1, two_yearly: 0.5 } as const;

export const DueBadge = ({ r }: { r: Renewal }) =>
  r.status !== "active" ? (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600 ring-1 ring-inset ring-slate-200">
      {r.status}
    </span>
  ) : (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", URGENCY_STYLES[urgency(r.daysLeft, r.remindDaysBefore)])}>
      {dueLabel(r.daysLeft)}
    </span>
  );

const History = ({ id }: { id: string }) => {
  const { data, isLoading } = useQuery({ queryKey: ["renewal", id], queryFn: () => api.renewal(id) });
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading history…</p>;
  if (!data?.history?.length) return <p className="text-xs text-muted-foreground">Not renewed yet in this app.</p>;
  return (
    <table className="w-full max-w-2xl text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-4 font-medium">Renewed on</th>
          <th className="py-1 pr-4 font-medium">Period covered</th>
          <th className="py-1 pr-4 text-right font-medium">Amount</th>
          <th className="py-1 font-medium">Invoice</th>
        </tr>
      </thead>
      <tbody>
        {data.history.map((h) => (
          <tr key={h.id} className="border-t border-border/60">
            <td className="py-1.5 pr-4">{formatDate(h.renewedOn)}</td>
            <td className="py-1.5 pr-4">
              {formatDate(h.periodFrom)} – {formatDate(h.periodTo)}
            </td>
            <td className="py-1.5 pr-4 text-right tabular">{formatCurrency(h.amount)}</td>
            <td className="py-1.5">
              {h.invoiceId ? (
                <Link to={`/documents/${h.invoiceId}`} className="font-mono text-primary hover:underline">
                  {h.invoiceNumber}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Renewals = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RenewalStatus | "due">("due");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Renewal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: all = [], isLoading, error } = useQuery({
    queryKey: ["renewals", q],
    queryFn: () => api.renewals({ q }),
    placeholderData: (prev) => prev,
  });

  const active = all.filter((r) => r.status === "active");
  const due = active.filter((r) => (r.daysLeft ?? 0) <= r.remindDaysBefore);
  const rows = filter === "due" ? due : all.filter((r) => r.status === filter);
  const overdue = active.filter((r) => (r.daysLeft ?? 0) < 0);
  const next30 = active.filter((r) => (r.daysLeft ?? 0) >= 0 && (r.daysLeft ?? 0) <= 30);
  const yearlyValue = active.reduce((s, r) => s + r.amount * YEARLY_FACTOR[r.billingCycle], 0);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["renewals"] });
    queryClient.invalidateQueries({ queryKey: ["renewal"] });
    queryClient.invalidateQueries({ queryKey: ["reminders"] });
  };

  const markRenewed = async (r: Renewal) => {
    if (!window.confirm(`Mark "${r.serviceName}" as renewed without an invoice? The next renewal date moves forward by one cycle.`)) return;
    try {
      const saved = await api.markRenewed(r.id!);
      toast.success(`Renewed — next due ${formatDate(saved.nextRenewalDate)}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (r: Renewal) => {
    if (!window.confirm(`Delete "${r.serviceName}" and its renewal history?`)) return;
    try {
      await api.deleteRenewal(r.id!);
      toast.success("Renewal deleted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reminded = (r: Renewal) => {
    api.markReminded(r.id!).then(refresh).catch(() => undefined);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Renewals</h1>
          <p className="text-sm text-muted-foreground">Recurring client services — domains, hosting, SSL, AMC and licences.</p>
        </div>
        <Button className="bg-brand-gradient" onClick={() => setEditing(blankRenewal())}>
          <Plus className="mr-1.5 h-4 w-4" /> Add renewal
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Overdue", value: String(overdue.length), hint: formatCurrency(overdue.reduce((s, r) => s + r.amount, 0)), tone: "text-red-600" },
          { label: "Due in 30 days", value: String(next30.length), hint: formatCurrency(next30.reduce((s, r) => s + r.amount, 0)), tone: "text-amber-600" },
          { label: "Active services", value: String(active.length), hint: `${all.length - active.length} paused / cancelled`, tone: "text-foreground" },
          { label: "Recurring value / year", value: formatCurrency(yearlyValue), hint: "Before GST", tone: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn("mt-2 text-2xl font-bold tabular", s.tone)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                {f.key === "due" && due.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{due.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 md:ml-auto md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search service or client…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {error ? (
          <p className="p-10 text-center text-sm text-destructive">{(error as Error).message}</p>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">
              {isLoading ? "Loading…" : filter === "due" ? "Nothing due — you're all caught up" : "No renewals here"}
            </p>
            {!isLoading && all.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">Add your clients' domains, hosting and AMCs to get reminders.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-3 py-3">Service</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Cycle</th>
                  <th className="px-3 py-3">Next renewal</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-muted/30">
                      <td className="px-2 py-3">
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          onClick={() => setExpanded(expanded === r.id ? null : r.id!)}
                          aria-label="Show renewal history"
                        >
                          {expanded === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{r.serviceName}</div>
                        <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{r.clientName}</div>
                        {r.lastRemindedOn && <div className="text-xs text-muted-foreground">Reminded {formatDate(r.lastRemindedOn)}</div>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{CYCLE_LABELS[r.billingCycle]}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{formatDate(r.nextRenewalDate)}</div>
                        <DueBadge r={r} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular">{formatCurrency(r.amount)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "active" && (
                            <>
                              <ReminderButton
                                email={r.clientEmail}
                                phone={r.clientPhone}
                                subject={`Renewal reminder: ${r.serviceName}`}
                                message={(c) => renewalReminderText(r, c)}
                                onSent={() => reminded(r)}
                              />
                              <Button size="sm" className="h-8 gap-1.5" onClick={() => navigate(`/invoice/new?renewal=${r.id}`)}>
                                <FilePlus2 className="h-3.5 w-3.5" /> Invoice
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => markRenewed(r)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark renewed (no invoice)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditing({ ...r })}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setExpanded(r.id!)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Renewal history
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => remove(r)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="bg-muted/20">
                        <td />
                        <td colSpan={6} className="px-3 py-3">
                          {r.description && <p className="mb-2 text-xs text-muted-foreground">{r.description}</p>}
                          {r.notes && <p className="mb-2 text-xs text-muted-foreground">Notes: {r.notes}</p>}
                          <History id={r.id!} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RenewalDialog
        renewal={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
    </AppLayout>
  );
};

export default Renewals;
