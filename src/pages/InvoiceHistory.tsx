import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Search, FileText, Trash2, ArrowLeft } from "lucide-react";
import { InvoiceData } from "@/types/invoice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInvoices, deleteInvoice } from "@/utils/invoiceStorage";
import { toast } from "sonner";

const InvoiceHistory = () => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "invoice" | "proforma">("all");
  const [isLoading, setIsLoading] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const saved = await getInvoices();
      setInvoices(saved);
    } catch (error) {
      console.error("Failed to load invoices", error);
      toast.error("Unable to load invoices from history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteInvoice(id);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        toast.success("Invoice deleted.");
      } catch (error) {
        console.error("Failed to delete invoice", error);
        toast.error("Unable to delete invoice. Please try again.");
      }
    },
    []
  );

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || invoice.type === filterType;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const calculateTotal = (invoice: InvoiceData) => {
    const subtotal = invoice.items.reduce((sum, item) => {
      const discountedRate = item.rate - (item.rate * item.discount / 100);
      return sum + discountedRate;
    }, 0);
    const tax = (subtotal * invoice.taxRate) / 100;
    return subtotal + tax;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoice History</h1>
            <p className="text-muted-foreground">Manage all your invoices in one place</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by invoice number or client name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="proforma">Proforma</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Loading invoices...</h3>
              <p className="text-muted-foreground">Fetching records from Google Sheets</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No invoices found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterType !== "all"
                  ? "Try adjusting your search or filter"
                  : "Create your first invoice to get started"}
              </p>
              <Link to="/">
                <Button>Create Invoice</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">
                          {invoice.invoiceNumber}
                        </h3>
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                          {invoice.type === "invoice" ? "Invoice" : "Proforma"}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-3 gap-2 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Client:</span>{" "}
                          {invoice.clientName}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Date:</span>{" "}
                          {new Date(invoice.date).toLocaleDateString()}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Total:</span>{" "}
                          {formatCurrency(calculateTotal(invoice))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={invoice.type === "invoice" ? "/invoice" : "/proforma"}
                        state={{ invoice }}
                      >
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => invoice.id && handleDelete(invoice.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default InvoiceHistory;
