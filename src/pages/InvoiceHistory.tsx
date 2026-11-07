import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import StatusBadge, { TypeBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/invoiceMath";
import { DocType, InvoiceStatus } from "@/types/invoice";

const InvoiceHistory = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState<DocType | "all">("all");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ["invoices", type, status, q],
    queryFn: () => api.invoices({ type: type === "all" ? "" : type, status: status === "all" ? "" : status, q }),
    placeholderData: (prev) => prev,
  });

  const total = invoices.reduce((sum, i) => sum + (i.status !== "cancelled" ? i.grandTotal || 0 : 0), 0);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Invoices &amp; proformas</h1>
        <p className="text-sm text-muted-foreground">
          Every document is stored as data. Open one to edit it or print it again.
        </p>
      </div>

      <Card className="shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search number, client or company…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as DocType | "all")}>
            <SelectTrigger className="md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="invoice">Tax invoices</SelectItem>
              <SelectItem value="proforma">Proformas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | "all")}>
            <SelectTrigger className="md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <p className="p-10 text-center text-sm text-destructive">{(error as Error).message}</p>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">{isLoading ? "Loading…" : "No documents found"}</p>
            {!isLoading && (
              <Button asChild className="mt-4 bg-brand-gradient">
                <Link to="/invoice/new">Create invoice</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/documents/${inv.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/documents/${inv.id}`} className="font-mono font-semibold hover:text-primary" onClick={(e) => e.stopPropagation()}>
                          {inv.invoiceNumber}
                        </Link>
                        <TypeBadge type={inv.type} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.clientName}</div>
                      {inv.clientCompany && <div className="text-xs text-muted-foreground">{inv.clientCompany}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge invoice={inv} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular">{formatCurrency(inv.grandTotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 text-sm">
                  <td colSpan={5} className="px-4 py-3 text-muted-foreground">
                    {invoices.length} document{invoices.length === 1 ? "" : "s"} (excluding cancelled from total)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  );
};

export default InvoiceHistory;
