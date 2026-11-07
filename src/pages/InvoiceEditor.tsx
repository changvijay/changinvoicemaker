import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileCheck2, Loader2, MoreHorizontal, Printer, Save, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import StatusBadge, { TypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { addDays, formatDate, todayIso } from "@/lib/invoiceMath";
import { renewalPeriod } from "@/lib/renewals";
import { Client, CompanySettings, DocType, InvoiceData, InvoiceStatus, Renewal } from "@/types/invoice";

const blankDocument = (type: DocType, s: CompanySettings): InvoiceData => {
  const date = todayIso();
  return {
    type,
    invoiceNumber: "",
    status: "draft",
    date,
    dueDate: addDays(date, s.defaultDueDays || 15),
    clientId: null,
    clientName: "",
    clientCompany: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    clientGstin: "",
    placeOfSupply: s.state,
    taxMode: "cgst_sgst",
    taxRate: s.defaultTaxRate ?? 18,
    items: [{ description: "", hsnSac: "", quantity: 1, unitPrice: 0, discountPct: 0 }],
    notes: "",
    terms: s.defaultTerms,
  };
};

/** A new invoice pre-filled for one renewal of a recurring service. */
const renewalDocument = (r: Renewal, s: CompanySettings, client?: Client): InvoiceData => {
  const base = blankDocument("invoice", s);
  const period = renewalPeriod(r.nextRenewalDate, r.billingCycle);
  const state = client?.state || s.state;
  return {
    ...base,
    clientId: client?.id ?? r.clientId ?? null,
    clientName: client?.name || r.clientName,
    clientCompany: client?.company || "",
    clientEmail: client?.email || r.clientEmail,
    clientPhone: client?.phone || r.clientPhone,
    clientAddress: client?.address || "",
    clientGstin: client?.gstin || "",
    placeOfSupply: state,
    taxMode: state && s.state && state.trim().toLowerCase() !== s.state.trim().toLowerCase() ? "igst" : "cgst_sgst",
    items: [
      {
        description: [`${r.serviceName} — renewal for ${formatDate(period.from)} to ${formatDate(period.to)}`, r.description]
          .filter(Boolean)
          .join("\n"),
        hsnSac: r.hsnSac,
        quantity: 1,
        unitPrice: r.amount,
        discountPct: 0,
        renewalCycle: r.billingCycle,
        nextRenewalDate: addDays(period.to, 1),
        renewalId: r.id,
      },
    ],
    notes: `Renewal of ${r.serviceName}. Next renewal due on ${formatDate(addDays(period.to, 1))}.`,
  };
};

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "cancelled"];

const InvoiceEditor = ({ newType }: { newType?: DocType }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: () => api.clients() });
  const docQuery = useQuery({ queryKey: ["invoice", id], queryFn: () => api.invoice(id!), enabled: !!id });
  const [searchParams] = useSearchParams();
  const renewalId = !id && newType === "invoice" ? searchParams.get("renewal") : null;
  const renewalQuery = useQuery({ queryKey: ["renewal", renewalId], queryFn: () => api.renewal(renewalId!), enabled: !!renewalId });

  const [doc, setDoc] = useState<InvoiceData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const loadedKey = useRef<string>("");

  // Load the document once per route (new type or saved id).
  useEffect(() => {
    const key = id || `new-${newType}-${renewalId || ""}`;
    if (loadedKey.current === key) return;
    const settings = settingsQuery.data;
    if (id && docQuery.data && docQuery.data.id === id && settings) {
      const loaded = docQuery.data;
      setDoc({ ...loaded, items: loaded.items?.length ? loaded.items : blankDocument(loaded.type, settings).items });
      loadedKey.current = key;
      setDirty(false);
    } else if (!id && newType && settings && renewalId) {
      if (!renewalQuery.data || !clientsQuery.data) return setDoc(null);
      const r = renewalQuery.data;
      setDoc(renewalDocument(r, settings, clientsQuery.data.find((c) => c.id === r.clientId)));
      loadedKey.current = key;
      setDirty(true);
    } else if (!id && newType && settings) {
      setDoc(blankDocument(newType, settings));
      loadedKey.current = key;
      setDirty(false);
    } else {
      setDoc(null); // show the spinner rather than the previous document
    }
  }, [id, newType, renewalId, docQuery.data, settingsQuery.data, renewalQuery.data, clientsQuery.data]);

  const { data: nextNumber } = useQuery({
    queryKey: ["next-number", doc?.type, doc?.date],
    queryFn: () => api.nextNumber(doc!.type, doc!.date),
    enabled: !!doc && !doc.id,
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const previewDoc = useMemo(
    () => (doc && !doc.id && !doc.invoiceNumber && nextNumber ? { ...doc, invoiceNumber: nextNumber } : doc),
    [doc, nextNumber]
  );

  const update = (next: InvoiceData) => {
    setDoc(next);
    setDirty(true);
  };

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["reminders"] });
    queryClient.invalidateQueries({ queryKey: ["renewals"] });
    queryClient.invalidateQueries({ queryKey: ["renewal"] });
  };

  const save = async (): Promise<InvoiceData | null> => {
    if (!doc) return null;
    if (!doc.clientName.trim()) {
      toast.error("Add the client's name before saving.");
      return null;
    }
    setSaving(true);
    try {
      const saved = await api.saveInvoice(doc);
      setDoc(saved);
      setDirty(false);
      queryClient.setQueryData(["invoice", saved.id], saved);
      refreshLists();
      toast.success(`${saved.invoiceNumber} saved`);
      const renewed = saved.items.filter((i) => i.renewalCycle && i.nextRenewalDate);
      if (saved.type === "invoice" && renewed.length) {
        toast.success(
          renewed.length === 1
            ? `Renewal reminder set for ${formatDate(renewed[0].nextRenewalDate)}`
            : `${renewed.length} renewal reminders updated`
        );
      }
      if (!doc.id) {
        loadedKey.current = saved.id!;
        navigate(`/documents/${saved.id}`, { replace: true });
      }
      return saved;
    } catch (error) {
      toast.error((error as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    let current = doc;
    if (dirty || !doc?.id) {
      current = await save();
      if (!current) return;
    }
    const previousTitle = document.title;
    document.title = (current?.invoiceNumber || "invoice").replace(/[/\\]/g, "-"); // becomes the PDF file name
    setTimeout(() => {
      window.print();
      document.title = previousTitle;
    }, 150);
  };

  const changeStatus = async (status: InvoiceStatus) => {
    if (!doc?.id) return;
    try {
      const saved = await api.setStatus(doc.id, status);
      setDoc((d) => (d ? { ...d, status: saved.status } : d));
      refreshLists();
      toast.success(`Marked as ${status}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const copyTo = async (mode: "duplicate" | "convert") => {
    if (!doc?.id) return;
    if (dirty && !(await save())) return;
    try {
      const created = mode === "convert" ? await api.convert(doc.id) : await api.duplicate(doc.id);
      refreshLists();
      toast.success(mode === "convert" ? `Tax invoice ${created.invoiceNumber} created` : `Copy ${created.invoiceNumber} created`);
      navigate(`/documents/${created.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const remove = async () => {
    if (!doc?.id) return;
    try {
      await api.deleteInvoice(doc.id);
      refreshLists();
      toast.success(`${doc.invoiceNumber} deleted`);
      navigate("/documents");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const error = settingsQuery.error || docQuery.error;
  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="font-semibold">Couldn't load this document</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/documents">Back to invoices</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!doc || !previewDoc || !settingsQuery.data) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isProforma = doc.type === "proforma";

  return (
    <AppLayout
      actions={
        <>
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {dirty || !doc.id ? "Save" : "Saved"}
          </Button>
          <Button size="sm" className="bg-brand-gradient hover:opacity-90" onClick={print} disabled={saving}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
          </Button>
          {doc.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Mark as</DropdownMenuLabel>
                {STATUSES.filter((s) => s !== doc.status).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => changeStatus(s)} className="capitalize">
                    {s}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {isProforma && (
                  <DropdownMenuItem onClick={() => copyTo("convert")}>
                    <FileCheck2 className="mr-2 h-4 w-4" /> Convert to tax invoice
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => copyTo("duplicate")}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link to="/documents" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              {doc.id ? doc.invoiceNumber : isProforma ? "New proforma invoice" : renewalId ? "New renewal invoice" : "New tax invoice"}
            </h1>
            <TypeBadge type={doc.type} />
            {doc.id && <StatusBadge invoice={doc} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {doc.id
              ? "Saved in the database — edit and re-print any time."
              : renewalId
                ? "Pre-filled from the renewal. Saving it records the renewal and moves the next due date forward."
                : "Fill in the details. The document number is reserved when you first save."}
            {dirty && doc.id && <span className="ml-2 font-medium text-amber-600">Unsaved changes</span>}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="print:hidden">
          <InvoiceForm data={doc} onChange={update} clients={clientsQuery.data || []} companyState={settingsQuery.data.state} />
        </div>
        <div className="xl:sticky xl:top-24 print:static">
          <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">
            <div className="min-w-[720px] print:min-w-0">
              <InvoicePreview data={previewDoc} company={settingsQuery.data} />
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {doc.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document and its line items from the database. Its number will not be reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default InvoiceEditor;
