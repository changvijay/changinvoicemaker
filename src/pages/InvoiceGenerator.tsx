import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Save, Download, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import { InvoiceData } from "@/types/invoice";
import { saveInvoice } from "@/utils/invoiceStorage";
import { toast } from "sonner";

const InvoiceGenerator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: `INV-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    dueDate: "",
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    items: [{ description: "", rate: 0, discount: 0 }],
    taxRate: 18,
    notes: "",
    type: "invoice",
  });

  useEffect(() => {
    if (location.state?.invoice) {
      setInvoiceData(location.state.invoice);
    }
  }, [location]);

  const handlePrint = () => {
    window.print();
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const saved = await saveInvoice(invoiceData);
      setInvoiceData(saved);
      toast.success("Invoice saved successfully!");
    } catch (error) {
      console.error("Failed to save invoice", error);
      toast.error("Unable to save invoice. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="bg-gradient-to-r from-primary via-primary/95 to-accent py-8 shadow-2xl print:hidden relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 backdrop-blur-sm rounded-lg">
                  <FileText className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-primary-foreground tracking-tight">Invoice Generator</h1>
                  <p className="text-primary-foreground/90 mt-1 font-medium">CHANG IT SOLUTIONS</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate("/")}
                variant="secondary"
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleSave}
                variant="secondary"
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                size="lg"
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handlePrint}
                className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="print:hidden sticky top-4">
            <InvoiceForm 
              data={invoiceData} 
              onChange={setInvoiceData}
              type="invoice"
            />
          </div>
          <div className="print:col-span-2">
            <InvoicePreview data={invoiceData} type="invoice" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvoiceGenerator;
