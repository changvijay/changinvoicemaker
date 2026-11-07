import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/invoiceMath";
import { Client } from "@/types/invoice";

type Draft = Omit<Client, "id"> & { id?: string };
const EMPTY: Draft = { name: "", company: "", email: "", phone: "", address: "", gstin: "", state: "" };

const Clients = () => {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients", q],
    queryFn: () => api.clients(q),
    placeholderData: (prev) => prev,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const save = async () => {
    if (!editing?.name.trim()) {
      toast.error("Client name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) await api.updateClient(editing.id, editing);
      else await api.createClient(editing);
      toast.success(`${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Client) => {
    if (!window.confirm(`Delete ${c.name}? Existing invoices keep their copy of the client details.`)) return;
    try {
      await api.deleteClient(c.id);
      toast.success(`${c.name} deleted`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const field = (key: keyof Draft, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={(editing?.[key] as string) || ""} onChange={(e) => setEditing((d) => d && { ...d, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Clients are saved automatically the first time you bill them.</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })} className="bg-brand-gradient">
          <Plus className="mr-1.5 h-4 w-4" /> Add client
        </Button>
      </div>

      <Card className="shadow-sm">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {error ? (
          <p className="p-10 text-center text-sm text-destructive">{(error as Error).message}</p>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">{isLoading ? "Loading…" : "No clients yet"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3 text-right">Documents</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{c.email}</div>
                      <div className="text-xs">{c.phone}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.gstin || "—"}</td>
                    <td className="px-4 py-3 text-right tabular">{c.invoiceCount ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular">{formatCurrency(c.totalBilled || 0)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...c })} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(c)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit client" : "Add client"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {field("name", "Contact name *")}
            {field("company", "Company")}
            {field("email", "Email", { type: "email" })}
            {field("phone", "Phone")}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Textarea rows={3} className="resize-none" value={editing?.address || ""} onChange={(e) => setEditing((d) => d && { ...d, address: e.target.value })} />
            </div>
            {field("gstin", "GSTIN", { className: "font-mono uppercase", maxLength: 15 })}
            {field("state", "State")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Clients;
