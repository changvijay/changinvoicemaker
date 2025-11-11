import { FileText, Receipt, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary to-accent py-8 shadow-lg">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary-foreground">CHANG IT SOLUTIONS</h1>
            <p className="text-primary-foreground/90 mt-2">Professional Invoice Management System</p>
          </div>
          <Button
            onClick={() => navigate("/history")}
            variant="secondary"
            className="gap-2"
          >
            <History className="w-4 h-4" />
            View History
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
            Choose Invoice Type
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 hover:shadow-xl transition-shadow duration-300 border-2 hover:border-primary">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Invoice</h3>
                <p className="text-muted-foreground">
                  Generate professional invoices for completed services and delivered products
                </p>
                <Button 
                  onClick={() => navigate("/invoice")}
                  className="w-full mt-4"
                  size="lg"
                >
                  Create Invoice
                </Button>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-shadow duration-300 border-2 hover:border-accent">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Proforma Invoice</h3>
                <p className="text-muted-foreground">
                  Create proforma invoices for quotations and advance payment requests
                </p>
                <Button 
                  onClick={() => navigate("/proforma")}
                  className="w-full mt-4 bg-accent hover:bg-accent/90"
                  size="lg"
                >
                  Create Proforma
                </Button>
              </div>
            </Card>
          </div>

          <Card className="mt-12 p-6 bg-muted/50">
            <h3 className="text-xl font-semibold text-foreground mb-4">About Our Invoice System</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Professional and customizable invoice templates</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Automatic calculation of totals and taxes</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Print-ready format for easy sharing</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Support for multiple line items and services</span>
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
