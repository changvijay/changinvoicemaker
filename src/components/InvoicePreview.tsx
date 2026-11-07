import { useState } from "react";
import { CompanySettings, InvoiceData } from "@/types/invoice";
import { amountInWords, computeTotals, formatAmount, formatCurrency, formatDate, lineAmount } from "@/lib/invoiceMath";
import { CYCLE_LABELS } from "@/lib/renewals";

interface InvoicePreviewProps {
  data: InvoiceData;
  company: CompanySettings;
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</div>
);

const InvoicePreview = ({ data, company }: InvoicePreviewProps) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const totals = computeTotals(data);
  const isProforma = data.type === "proforma";
  const title = isProforma ? "Proforma Invoice" : data.taxMode === "none" ? "Invoice" : "Tax Invoice";
  const items = data.items.filter((i) => i.description || i.unitPrice > 0);
  const hasDiscount = items.some((i) => i.discountPct > 0);
  const hasHsn = items.some((i) => i.hsnSac);
  const halfRate = (data.taxRate || 0) / 2;
  const hasBank = company.bankAccountNumber || company.bankName || company.upiId;
  const stamp = data.status === "paid" ? "PAID" : data.status === "cancelled" ? "CANCELLED" : "";

  return (
    <div className="invoice-sheet relative mx-auto w-full max-w-[210mm] bg-white text-slate-800 shadow-xl ring-1 ring-slate-200 print:shadow-none print:ring-0">
      <div className="h-1.5 bg-brand-gradient" />

      {stamp && (
        <div
          className={`pointer-events-none absolute right-10 top-40 rotate-[-14deg] rounded-md border-4 px-4 py-1 text-3xl font-extrabold tracking-widest opacity-25 ${
            stamp === "PAID" ? "border-emerald-600 text-emerald-600" : "border-red-600 text-red-600"
          }`}
        >
          {stamp}
        </div>
      )}

      <div className="px-10 pb-8 pt-8 print:px-[12mm]">
        {/* Header */}
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {company.logoUrl && !logoFailed ? (
              <img
                src={company.logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-xl font-bold text-white">
                {company.name.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight text-slate-900">{company.name}</h1>
              {company.tagline && <p className="text-xs font-medium text-indigo-600">{company.tagline}</p>}
              <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{company.address}</p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                {[company.phone, company.email].filter(Boolean).join("  ·  ")}
              </p>
              {(company.gstin || company.pan) && (
                <p className="text-[11px] font-medium leading-relaxed text-slate-700">
                  {company.gstin && <>GSTIN: {company.gstin}</>}
                  {company.gstin && company.pan && "  ·  "}
                  {company.pan && <>PAN: {company.pan}</>}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-extrabold uppercase tracking-wide text-brand-gradient">{title}</h2>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
              {data.invoiceNumber || "Number assigned on save"}
            </p>
            {!isProforma && data.taxMode !== "none" && (
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">Original for recipient</p>
            )}
          </div>
        </header>

        {/* Meta strip */}
        <section className="mt-6 grid grid-cols-[1.6fr_1fr_1fr_1.2fr] divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70 text-sm">
          {[
            [isProforma ? "Proforma No." : "Invoice No.", data.invoiceNumber || "—"],
            ["Issue Date", formatDate(data.date)],
            [isProforma ? "Valid Until" : "Due Date", formatDate(data.dueDate)],
            ["Place of Supply", data.placeOfSupply || company.state || "—"],
          ].map(([label, value]) => (
            <div key={label} className="px-3 py-2.5">
              <Label>{label}</Label>
              <div className="mt-0.5 whitespace-nowrap text-[13px] font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        {/* Parties */}
        <section className="mt-5 grid grid-cols-2 gap-5">
          <div className="rounded-lg border border-slate-200 p-4">
            <Label>Bill To</Label>
            <p className="mt-1 text-base font-bold text-slate-900">{data.clientName || "Client name"}</p>
            {data.clientCompany && <p className="text-sm font-medium text-slate-700">{data.clientCompany}</p>}
            {data.clientAddress && (
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{data.clientAddress}</p>
            )}
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
              {data.clientEmail && <p>{data.clientEmail}</p>}
              {data.clientPhone && <p>{data.clientPhone}</p>}
              {data.clientGstin && <p className="font-medium text-slate-700">GSTIN: {data.clientGstin}</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <Label>Amount {isProforma ? "Payable" : data.status === "paid" ? "Paid" : "Due"}</Label>
            <p className="mt-1 text-2xl font-extrabold tabular text-slate-900">{formatCurrency(totals.grandTotal)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {data.dueDate ? `${isProforma ? "Valid until" : "Due by"} ${formatDate(data.dueDate)}` : "Due on receipt"}
            </p>
            <div className="mt-3 border-t border-dashed border-slate-200 pt-2 text-xs text-slate-600">
              Tax:{" "}
              <span className="font-medium text-slate-800">
                {data.taxMode === "none"
                  ? "Not applicable"
                  : data.taxMode === "igst"
                    ? `IGST @ ${data.taxRate}% (inter-state)`
                    : `CGST ${halfRate}% + SGST ${halfRate}% (intra-state)`}
              </span>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                <th className="w-8 py-2.5 pl-3">#</th>
                <th className="py-2.5 pr-2">Description</th>
                {hasHsn && <th className="w-20 py-2.5 pr-2">HSN/SAC</th>}
                <th className="w-14 py-2.5 pr-2 text-right">Qty</th>
                <th className="w-24 py-2.5 pr-2 text-right">Rate</th>
                {hasDiscount && <th className="w-14 py-2.5 pr-2 text-right">Disc.</th>}
                <th className="w-28 py-2.5 pr-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Add line items to see them here
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index} className="align-top even:bg-slate-50/60">
                    <td className="py-2.5 pl-3 text-slate-400 tabular">{index + 1}</td>
                    <td className="py-2.5 pr-2">
                      <div className="whitespace-pre-line font-medium text-slate-800">{item.description}</div>
                      {item.renewalCycle && item.nextRenewalDate && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                          ↻ Renews {CYCLE_LABELS[item.renewalCycle].toLowerCase()} · Next renewal: {formatDate(item.nextRenewalDate)}
                        </div>
                      )}
                    </td>
                    {hasHsn && <td className="py-2.5 pr-2 font-mono text-xs text-slate-600">{item.hsnSac}</td>}
                    <td className="py-2.5 pr-2 text-right tabular text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 pr-2 text-right tabular text-slate-700">{formatAmount(item.unitPrice)}</td>
                    {hasDiscount && (
                      <td className="py-2.5 pr-2 text-right tabular text-slate-600">
                        {item.discountPct ? `${item.discountPct}%` : "—"}
                      </td>
                    )}
                    <td className="py-2.5 pr-3 text-right font-semibold tabular text-slate-900">
                      {formatAmount(lineAmount(item))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Totals + words */}
        <section className="mt-5 grid grid-cols-[1fr_17rem] gap-6 break-inside-avoid">
          <div className="self-end">
            <Label>Amount in words</Label>
            <p className="mt-1 text-sm font-medium italic text-slate-800">{amountInWords(totals.grandTotal)}</p>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.discountTotal > 0 && <Row label="Discount" value={-totals.discountTotal} />}
            {totals.discountTotal > 0 && <Row label="Taxable value" value={totals.taxable} />}
            {data.taxMode === "cgst_sgst" && (
              <>
                <Row label={`CGST @ ${halfRate}%`} value={totals.halfTax} />
                <Row label={`SGST @ ${halfRate}%`} value={totals.taxTotal - totals.halfTax} />
              </>
            )}
            {data.taxMode === "igst" && <Row label={`IGST @ ${data.taxRate}%`} value={totals.taxTotal} />}
            <div className="mt-2 flex items-center justify-between rounded-md bg-brand-gradient px-3 py-2.5 text-white">
              <span className="text-sm font-semibold">Total (INR)</span>
              <span className="text-lg font-extrabold tabular">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </section>

        {/* Bank + signature */}
        <section className="mt-7 grid grid-cols-2 gap-6 border-t border-slate-200 pt-5 break-inside-avoid">
          <div>
            {hasBank ? (
              <>
                <Label>Payment details</Label>
                <dl className="mt-1.5 grid grid-cols-[6.5rem_1fr] gap-y-0.5 text-xs">
                  {company.bankAccountName && <Detail k="Account name" v={company.bankAccountName} />}
                  {company.bankName && <Detail k="Bank" v={company.bankName} />}
                  {company.bankAccountNumber && <Detail k="Account no." v={company.bankAccountNumber} mono />}
                  {company.bankIfsc && <Detail k="IFSC" v={company.bankIfsc} mono />}
                  {company.bankBranch && <Detail k="Branch" v={company.bankBranch} />}
                  {company.upiId && <Detail k="UPI" v={company.upiId} mono />}
                </dl>
              </>
            ) : (
              <p className="text-xs text-slate-400 print:hidden">Add bank / UPI details in Settings to show them here.</p>
            )}
          </div>
          <div className="flex flex-col items-end justify-end text-right">
            <p className="text-xs text-slate-600">For {company.name}</p>
            <div className="mt-12 w-48 border-t border-slate-300 pt-1 text-xs font-semibold text-slate-800">
              {company.signatoryName || "Authorised Signatory"}
            </div>
          </div>
        </section>

        {(data.terms || data.notes) && (
          <section className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid">
            {data.terms && (
              <div>
                <Label>Terms &amp; conditions</Label>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{data.terms}</p>
              </div>
            )}
            {data.notes && (
              <div className={data.terms ? "" : "col-span-2"}>
                <Label>Notes</Label>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{data.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
          <p className="font-medium text-slate-700">Thank you for your business!</p>
          <p className="mt-0.5">
            {[company.website, company.email, company.phone].filter(Boolean).join("  ·  ")}
          </p>
          <p className="mt-0.5">
            {isProforma
              ? "This is a proforma invoice for quotation / advance payment and is not a tax invoice."
              : "This is a computer-generated invoice."}
          </p>
        </footer>
      </div>
      <div className="h-1.5 bg-brand-gradient" />
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between px-1">
    <span className="text-slate-600">{label}</span>
    <span className="font-medium tabular text-slate-900">
      {value < 0 ? `− ${formatAmount(-value)}` : formatAmount(value)}
    </span>
  </div>
);

const Detail = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
  <>
    <dt className="text-slate-500">{k}</dt>
    <dd className={`font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{v}</dd>
  </>
);

export default InvoicePreview;
