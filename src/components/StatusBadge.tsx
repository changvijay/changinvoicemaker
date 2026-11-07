import { InvoiceData } from "@/types/invoice";
import { isOverdue } from "@/lib/invoiceMath";
import { cn } from "@/lib/utils";

const STYLES = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  overdue: "bg-amber-50 text-amber-800 ring-amber-200",
} as const;

const LABELS = { draft: "Draft", sent: "Sent", paid: "Paid", cancelled: "Cancelled", overdue: "Overdue" } as const;

const StatusBadge = ({ invoice, className }: { invoice: Pick<InvoiceData, "status" | "dueDate" | "type">; className?: string }) => {
  const key = isOverdue(invoice) ? "overdue" : invoice.status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", STYLES[key], className)}>
      {LABELS[key]}
    </span>
  );
};

export const TypeBadge = ({ type }: { type: InvoiceData["type"] }) => (
  <span
    className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
      type === "invoice" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
    )}
  >
    {type === "invoice" ? "Invoice" : "Proforma"}
  </span>
);

export default StatusBadge;
