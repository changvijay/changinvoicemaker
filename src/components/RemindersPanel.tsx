import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, FilePlus2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReminderButton from "@/components/ReminderButton";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/invoiceMath";
import { CATEGORY_LABELS, URGENCY_STYLES, dueLabel, invoiceReminderText, renewalReminderText, urgency } from "@/lib/renewals";
import { cn } from "@/lib/utils";

const DueChip = ({ daysLeft, remindDays = 7 }: { daysLeft: number; remindDays?: number }) => (
  <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", URGENCY_STYLES[urgency(daysLeft, remindDays)])}>
    {dueLabel(daysLeft)}
  </span>
);

const Empty = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {text}
  </div>
);

const RemindersPanel = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["reminders"], queryFn: api.reminders });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["reminders"] });
    queryClient.invalidateQueries({ queryKey: ["renewals"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const markPaid = async (id: string, number: string) => {
    try {
      await api.setStatus(id, "paid");
      toast.success(`${number} marked as paid`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const renewals = data?.renewals || [];
  const invoices = data?.invoices || [];
  const total = renewals.length + invoices.length;

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/5 to-accent/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-gradient p-2 text-white">
            <BellRing className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold">Reminders</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Checking…"
                : total === 0
                  ? "Nothing needs attention right now"
                  : `${total} item${total === 1 ? "" : "s"} need attention`}
              {data?.next30Days.count
                ? ` · ${data.next30Days.count} renewal${data.next30Days.count === 1 ? "" : "s"} worth ${formatCurrency(data.next30Days.amount)} in the next 30 days`
                : ""}
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/renewals">
            All renewals <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="p-5 text-sm text-destructive">{(error as Error).message}</p>
      ) : (
        <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {/* Renewals */}
          <section>
            <h3 className="flex items-center gap-2 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Renewals due ({renewals.length})
            </h3>
            {renewals.length === 0 ? (
              <Empty text="No renewals due" />
            ) : (
              <ul className="divide-y">
                {renewals.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.serviceName}</span>
                        <DueChip daysLeft={r.daysLeft ?? 0} remindDays={r.remindDaysBefore} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.clientName} · {CATEGORY_LABELS[r.category]} · {formatDate(r.nextRenewalDate)} · {formatCurrency(r.amount)}
                        {r.lastRemindedOn && ` · reminded ${formatDate(r.lastRemindedOn)}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <ReminderButton
                        size="icon"
                        email={r.clientEmail}
                        phone={r.clientPhone}
                        subject={`Renewal reminder: ${r.serviceName}`}
                        message={(c) => renewalReminderText(r, c)}
                        onSent={() => api.markReminded(r.id!).then(refresh).catch(() => undefined)}
                      />
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => navigate(`/invoice/new?renewal=${r.id}`)}>
                        <FilePlus2 className="h-3.5 w-3.5" /> Invoice
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {renewals.length > 6 && (
              <Link to="/renewals" className="block px-5 py-2 text-xs font-medium text-primary hover:underline">
                + {renewals.length - 6} more
              </Link>
            )}
          </section>

          {/* Payments */}
          <section>
            <h3 className="flex items-center gap-2 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Payments due ({invoices.length})
            </h3>
            {invoices.length === 0 ? (
              <Empty text="No unpaid invoices due this week" />
            ) : (
              <ul className="divide-y">
                {invoices.slice(0, 6).map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link to={`/documents/${inv.id}`} className="truncate font-mono text-sm font-semibold hover:text-primary">
                          {inv.invoiceNumber}
                        </Link>
                        <DueChip daysLeft={inv.daysLeft} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {inv.clientCompany || inv.clientName} · due {formatDate(inv.dueDate)} · {formatCurrency(inv.grandTotal || 0)}
                        {inv.status === "draft" && " · not sent yet"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <ReminderButton
                        size="icon"
                        email={inv.clientEmail}
                        phone={inv.clientPhone}
                        subject={`Payment reminder: ${inv.invoiceNumber}`}
                        message={(c) => invoiceReminderText(inv, c)}
                      />
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => markPaid(inv.id!, inv.invoiceNumber)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  );
};

export default RemindersPanel;
