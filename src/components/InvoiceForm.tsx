import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, User, Calendar, DollarSign, Package } from "lucide-react";
import { InvoiceData } from "@/types/invoice";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
  type: "invoice" | "proforma";
}

const InvoiceForm = ({ data, onChange, type }: InvoiceFormProps) => {
  const updateField = (field: keyof InvoiceData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange({ ...data, items: newItems });
  };

  const addItem = () => {
    onChange({
      ...data,
      items: [...data.items, { description: "", rate: 0, discount: 0 }],
    });
  };

  const removeItem = (index: number) => {
    if (data.items.length > 1) {
      onChange({
        ...data,
        items: data.items.filter((_, i) => i !== index),
      });
    }
  };

  return (
    <Card className="p-6 shadow-lg border-2 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {type === "invoice" ? "Invoice" : "Proforma Invoice"} Details
          </h2>
        </div>
        <Badge variant="outline" className="text-sm">
          {data.invoiceNumber || "New"}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Invoice Number & Date Section */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Document Information</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber" className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                {type === "invoice" ? "Invoice" : "Proforma"} Number
              </Label>
              <Input
                id="invoiceNumber"
                value={data.invoiceNumber}
                onChange={(e) => updateField("invoiceNumber", e.target.value)}
                className="font-mono"
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Issue Date
              </Label>
              <Input
                id="date"
                type="date"
                value={data.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="dueDate" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Due Date
            </Label>
            <Input
              id="dueDate"
              type="date"
              value={data.dueDate}
              onChange={(e) => updateField("dueDate", e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        {/* Client Details Section */}
        <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Client Information</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-sm font-medium">Client Name</Label>
              <Input
                id="clientName"
                value={data.clientName}
                onChange={(e) => updateField("clientName", e.target.value)}
                placeholder="Enter client name"
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail" className="text-sm font-medium">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={data.clientEmail}
                onChange={(e) => updateField("clientEmail", e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientAddress" className="text-sm font-medium">Client Address</Label>
              <Textarea
                id="clientAddress"
                value={data.clientAddress}
                onChange={(e) => updateField("clientAddress", e.target.value)}
                placeholder="Enter full client address"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Line Items</h3>
              <Badge variant="secondary" className="ml-2">{data.items.length}</Badge>
            </div>
            <Button onClick={addItem} size="sm" className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {data.items.map((item, index) => (
              <div key={index} className="p-4 border-2 rounded-lg space-y-3 bg-card shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Item {index + 1}
                    </span>
                  </div>
                  {data.items.length > 1 && (
                    <Button
                      onClick={() => removeItem(index)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Service or product description"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      Rate (₹)
                    </Label>
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Discount (%)</Label>
                    <Input
                      type="number"
                      value={item.discount}
                      onChange={(e) => updateItem(index, "discount", parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.01"
                      className="font-mono"
                    />
                  </div>
                </div>
                {item.rate > 0 && (
                  <div className="pt-2 border-t flex justify-between text-sm">
                    <span className="text-muted-foreground">Net Amount:</span>
                    <span className="font-semibold text-foreground">
                      ₹{(item.rate - (item.rate * item.discount / 100)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tax & Notes Section */}
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
            <Label htmlFor="taxRate" className="text-sm font-medium flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              Tax Rate (%)
            </Label>
            <Input
              id="taxRate"
              type="number"
              value={data.taxRate}
              onChange={(e) => updateField("taxRate", parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
              step="0.01"
              className="font-mono"
              placeholder="18"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes / Payment Terms</Label>
            <Textarea
              id="notes"
              value={data.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Additional notes, payment terms, or special instructions..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InvoiceForm;
