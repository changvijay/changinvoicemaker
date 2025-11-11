import { Card } from "@/components/ui/card";
import { InvoiceData } from "@/types/invoice";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, MapPin, Calendar, Phone } from "lucide-react";

interface InvoicePreviewProps {
  data: InvoiceData;
  type: "invoice" | "proforma";
}

const InvoicePreview = ({ data, type }: InvoicePreviewProps) => {
  const grossSubtotal = data.items.reduce((sum, item) => sum + item.rate, 0);
  const discountAmount = data.items.reduce(
    (sum, item) => sum + (item.rate * item.discount) / 100,
    0
  );
  const netSubtotal = grossSubtotal - discountAmount;
  const taxAmount = data.taxRate > 0 ? (netSubtotal * data.taxRate) / 100 : 0;
  const totalAmount = netSubtotal + taxAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  return (
    <Card className="invoice-card p-8 bg-card shadow-xl border-2">
      <div className="space-y-8">
        {/* Header with Gradient Background */}
        <div className="invoice-header relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/90 to-accent p-6 print-no-break">
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-8 h-8 text-primary-foreground" />
                  <h1 className="text-3xl font-bold text-primary-foreground">Chang Groups</h1>
                </div>
                <p className="text-primary-foreground/90 font-medium">IT Solutions & Services</p>
                <div className="flex flex-col gap-1 text-sm text-primary-foreground/80 mt-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    <span>changvijay54@mail.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    <span>7010747878</span>
                  </div>
                </div>
              </div>
              <div className="invoice-number text-right bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <h2 className="text-2xl font-bold text-primary-foreground uppercase tracking-wide">
                  {type === "invoice" ? "Invoice" : "Proforma"}
                </h2>
                <p className="text-primary-foreground/90 font-mono text-lg mt-1">
                  #{data.invoiceNumber}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Date and Client Information */}
        <div className="invoice-grid grid md:grid-cols-2 gap-6 print-no-break">
          {/* Bill To Section */}
          <div className="client-section space-y-3 p-5 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-wrapper w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-bold text-foreground uppercase tracking-wide text-sm">Bill To</h3>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-lg text-foreground">{data.clientName || "Client Name"}</p>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{data.clientEmail || "client@example.com"}</p>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="whitespace-pre-line">{data.clientAddress || "Client Address"}</p>
              </div>
            </div>
          </div>

          {/* Invoice Details Section */}
          <div className="invoice-details-section space-y-3 p-5 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-wrapper w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-bold text-foreground uppercase tracking-wide text-sm">Invoice Details</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-card rounded">
                <span className="text-sm font-medium text-muted-foreground">Issue Date:</span>
                <span className="font-semibold text-foreground">
                  {new Date(data.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Kolkata",
                  }).replace(/ /g, "-")}
                </span>
              </div>
              {data.dueDate && (
                <div className="flex justify-between items-center p-2 bg-card rounded">
                  <span className="text-sm font-medium text-muted-foreground">Due Date:</span>
                  <Badge variant="outline" className="badge font-semibold">
                    {new Date(data.dueDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    }).replace(/ /g, "-")}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="invoice-table-wrapper print-section">
          <div className="overflow-hidden rounded-lg border-2 border-border">
            <table className="invoice-table w-full">
              <thead>
                <tr className="bg-gradient-to-r from-muted to-muted/50">
                  <th className="text-left py-4 px-4 text-sm font-bold text-foreground uppercase tracking-wide">#</th>
                  <th className="text-left py-4 px-4 text-sm font-bold text-foreground uppercase tracking-wide">Description</th>
                  <th className="text-right py-4 px-4 text-sm font-bold text-foreground uppercase tracking-wide w-28">Rate</th>
                  <th className="text-right py-4 px-4 text-sm font-bold text-foreground uppercase tracking-wide w-24">Disc.</th>
                  <th className="text-right py-4 px-4 text-sm font-bold text-foreground uppercase tracking-wide w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item, index) => {
                  const discountedRate = item.rate - (item.rate * item.discount / 100);
                  return (
                    <tr key={index} className="hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4 text-sm font-semibold text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="py-4 px-4 text-sm text-foreground">
                        <div className="font-medium">{item.description || `Item ${index + 1}`}</div>
                      </td>
                      <td className="text-right py-4 px-4 text-sm text-muted-foreground font-mono">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="text-right py-4 px-4 text-sm font-mono">
                        {item.discount > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="badge text-xs">
                              -{item.discount}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              -{formatCurrency((item.rate * item.discount) / 100)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="text-right py-4 px-4 text-sm font-bold text-foreground font-mono">
                        {formatCurrency(discountedRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end print-no-break">
          <div className="invoice-totals w-96 space-y-3 p-6 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border">
            <div className="total-row flex justify-between items-center text-sm pb-2">
              <span className="text-muted-foreground font-medium">Subtotal (Before Discount):</span>
              <span className="font-semibold text-foreground font-mono text-base">{formatCurrency(grossSubtotal)}</span>
            </div>
            {discountAmount > 0 && (<div className="total-row flex justify-between items-center text-sm pb-2">
              <span className="text-muted-foreground font-medium">Discount:</span>
              <span className="font-semibold text-destructive font-mono text-base">
                {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : formatCurrency(0)}
              </span>
            </div>)}
            
            {taxAmount > 0 && (
              <div className="total-row flex justify-between items-center text-sm pb-2">
                <span className="text-muted-foreground font-medium">Tax ({data.taxRate}%):</span>
                <span className="font-semibold text-foreground font-mono text-base">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="total-final flex justify-between items-center pt-2">
              <span className="text-lg font-bold text-foreground">Total Amount:</span>
              <span className="amount text-2xl font-bold text-primary font-mono">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {data.notes && (
          <div className="invoice-notes mt-6 p-5 border-2 border-dashed border-border/50 rounded-lg bg-muted/20 print-no-break">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-primary rounded-full"></div>
              Notes & Payment Terms
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{data.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="invoice-footer mt-4 pt-6 border-t-2 border-border/50 print-no-break">
          <div className="text-center space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Thank you for your business! -
              <span className="text-xs text-muted-foreground">
                {" "}Chang Groups of IT Solutions - Delivering Excellence in IT Services
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InvoicePreview;
