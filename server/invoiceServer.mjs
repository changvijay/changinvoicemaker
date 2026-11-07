import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { pool, query, withTransaction, migrate } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- helpers ----------

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v, fallback = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
};
const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const CYCLES = ["monthly", "quarterly", "half_yearly", "yearly", "two_yearly"];
const dateOrNull = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Same maths as src/lib/invoiceMath.ts — keep them in sync. */
const computeTotals = (items, taxMode, taxRate) => {
  let subtotal = 0;
  let discountTotal = 0;
  for (const item of items) {
    const gross = item.quantity * item.unitPrice;
    const discount = (gross * item.discountPct) / 100;
    subtotal += gross;
    discountTotal += discount;
  }
  const taxable = subtotal - discountTotal;
  const taxTotal = taxMode === "none" ? 0 : (taxable * taxRate) / 100;
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(taxable + taxTotal),
  };
};

const fiscalYear = (isoDate) => {
  const d = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1; // Indian FY: April–March
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

const nextNumber = async (db, docType, issueDate) => {
  const fy = fiscalYear(issueDate);
  const { rows } = await db.query(
    `INSERT INTO number_sequences (doc_type, fiscal_year, last_value) VALUES ($1, $2, 1)
     ON CONFLICT (doc_type, fiscal_year) DO UPDATE SET last_value = number_sequences.last_value + 1
     RETURNING last_value`,
    [docType, fy]
  );
  const settings = (await db.query("SELECT invoice_prefix, proforma_prefix FROM company_settings WHERE id = 1")).rows[0];
  const prefix = docType === "proforma" ? settings.proforma_prefix : settings.invoice_prefix;
  return `${prefix}/${fy}/${String(rows[0].last_value).padStart(4, "0")}`;
};

const toSettings = (r) => ({
  name: r.name, tagline: r.tagline, email: r.email, phone: r.phone, website: r.website,
  address: r.address, state: r.state, stateCode: r.state_code, gstin: r.gstin, pan: r.pan,
  logoUrl: r.logo_url, bankName: r.bank_name, bankAccountName: r.bank_account_name,
  bankAccountNumber: r.bank_account_number, bankIfsc: r.bank_ifsc, bankBranch: r.bank_branch,
  upiId: r.upi_id, invoicePrefix: r.invoice_prefix, proformaPrefix: r.proforma_prefix,
  defaultTaxRate: r.default_tax_rate, defaultDueDays: r.default_due_days,
  defaultTerms: r.default_terms, signatoryName: r.signatory_name, updatedAt: r.updated_at,
});

const toClient = (r) => ({
  id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone,
  address: r.address, gstin: r.gstin, state: r.state, createdAt: r.created_at,
  invoiceCount: r.invoice_count != null ? Number(r.invoice_count) : undefined,
  totalBilled: r.total_billed != null ? Number(r.total_billed) : undefined,
});

const toInvoice = (r, items) => ({
  id: r.id, type: r.doc_type, invoiceNumber: r.invoice_number, status: r.status,
  date: r.issue_date, dueDate: r.due_date || "", clientId: r.client_id,
  clientName: r.client_name, clientCompany: r.client_company, clientEmail: r.client_email,
  clientPhone: r.client_phone, clientAddress: r.client_address, clientGstin: r.client_gstin,
  placeOfSupply: r.place_of_supply, taxMode: r.tax_mode, taxRate: r.tax_rate,
  subtotal: r.subtotal, discountTotal: r.discount_total, taxTotal: r.tax_total,
  grandTotal: r.grand_total, notes: r.notes, terms: r.terms, convertedFrom: r.converted_from,
  createdAt: r.created_at, updatedAt: r.updated_at,
  ...(items ? { items: items.map((i) => ({
    description: i.description, hsnSac: i.hsn_sac, quantity: i.quantity,
    unitPrice: i.unit_price, discountPct: i.discount_pct,
    renewalCycle: i.renewal_cycle || null, nextRenewalDate: i.next_renewal_date || "", renewalId: i.renewal_id || null,
  })) } : {}),
});

const parseInvoiceBody = (body = {}) => {
  const type = body.type === "proforma" ? "proforma" : "invoice";
  const taxMode = ["cgst_sgst", "igst", "none"].includes(body.taxMode) ? body.taxMode : "cgst_sgst";
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i) => ({
      description: str(i?.description),
      hsnSac: str(i?.hsnSac),
      quantity: Math.max(0, num(i?.quantity, 1)),
      unitPrice: Math.max(0, num(i?.unitPrice)),
      discountPct: Math.min(100, Math.max(0, num(i?.discountPct))),
      renewalCycle: CYCLES.includes(i?.renewalCycle) ? i.renewalCycle : null,
      nextRenewalDate: CYCLES.includes(i?.renewalCycle) ? dateOrNull(i?.nextRenewalDate) : null,
      renewalId: CYCLES.includes(i?.renewalCycle) ? str(i?.renewalId) || null : null,
    }))
    .filter((i) => i.description || i.unitPrice > 0);
  return {
    type,
    status: ["draft", "sent", "paid", "cancelled"].includes(body.status) ? body.status : "draft",
    invoiceNumber: str(body.invoiceNumber),
    date: dateOrNull(body.date) || new Date().toISOString().slice(0, 10),
    dueDate: dateOrNull(body.dueDate),
    clientId: str(body.clientId) || null,
    clientName: str(body.clientName),
    clientCompany: str(body.clientCompany),
    clientEmail: str(body.clientEmail),
    clientPhone: str(body.clientPhone),
    clientAddress: str(body.clientAddress),
    clientGstin: str(body.clientGstin).toUpperCase(),
    placeOfSupply: str(body.placeOfSupply),
    taxMode,
    taxRate: Math.min(100, Math.max(0, num(body.taxRate, 18))),
    notes: str(body.notes),
    terms: str(body.terms),
    items,
  };
};

/** Link the invoice to a saved client, creating one the first time a new client is billed. */
const resolveClient = async (db, inv) => {
  if (!inv.clientName) return null;
  if (inv.clientId) {
    const found = await db.query("SELECT id FROM clients WHERE id = $1", [inv.clientId]);
    if (found.rowCount) return inv.clientId;
  }
  const existing = await db.query(
    "SELECT id FROM clients WHERE lower(name) = lower($1) AND lower(email) = lower($2) LIMIT 1",
    [inv.clientName, inv.clientEmail]
  );
  if (existing.rowCount) return existing.rows[0].id;
  const created = await db.query(
    `INSERT INTO clients (name, company, email, phone, address, gstin, state)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [inv.clientName, inv.clientCompany, inv.clientEmail, inv.clientPhone, inv.clientAddress, inv.clientGstin, inv.placeOfSupply]
  );
  return created.rows[0].id;
};

const writeItems = async (db, invoiceId, items) => {
  await db.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);
  for (const [position, i] of items.entries()) {
    await db.query(
      `INSERT INTO invoice_items (invoice_id, position, description, hsn_sac, quantity, unit_price, discount_pct,
         renewal_cycle, next_renewal_date, renewal_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [invoiceId, position, i.description, i.hsnSac, i.quantity, i.unitPrice, i.discountPct,
       i.renewalCycle, i.nextRenewalDate, i.renewalId]
    );
  }
};

const loadInvoice = async (db, id) => {
  const inv = await db.query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (!inv.rowCount) return null;
  const items = await db.query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position", [id]);
  return toInvoice(inv.rows[0], items.rows);
};

const insertInvoice = async (db, inv, extra = {}) => {
  const totals = computeTotals(inv.items, inv.taxMode, inv.taxRate);
  const clientId = await resolveClient(db, inv);
  const number = inv.invoiceNumber || (await nextNumber(db, inv.type, inv.date));
  const { rows } = await db.query(
    `INSERT INTO invoices (doc_type, invoice_number, status, issue_date, due_date, client_id, client_name,
       client_company, client_email, client_phone, client_address, client_gstin, place_of_supply, tax_mode,
       tax_rate, subtotal, discount_total, tax_total, grand_total, notes, terms, converted_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    [inv.type, number, inv.status, inv.date, inv.dueDate, clientId, inv.clientName, inv.clientCompany,
     inv.clientEmail, inv.clientPhone, inv.clientAddress, inv.clientGstin, inv.placeOfSupply, inv.taxMode,
     inv.taxRate, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.grandTotal, inv.notes,
     inv.terms, extra.convertedFrom || null]
  );
  await syncRenewals(db, rows[0].id, inv, clientId);
  await writeItems(db, rows[0].id, inv.items);
  return rows[0].id;
};

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ success: false, message: "That document number is already in use." });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong on the server." });
  }
};

// ---------- routes ----------

app.get("/api/health", handle(async (_req, res) => {
  await query("SELECT 1");
  res.json({ success: true, database: process.env.PGDATABASE });
}));

app.get("/api/settings", handle(async (_req, res) => {
  const { rows } = await query("SELECT * FROM company_settings WHERE id = 1");
  res.json({ success: true, settings: toSettings(rows[0]) });
}));

app.put("/api/settings", handle(async (req, res) => {
  const b = req.body || {};
  const { rows } = await query(
    `UPDATE company_settings SET name=$1, tagline=$2, email=$3, phone=$4, website=$5, address=$6, state=$7,
       state_code=$8, gstin=$9, pan=$10, logo_url=$11, bank_name=$12, bank_account_name=$13,
       bank_account_number=$14, bank_ifsc=$15, bank_branch=$16, upi_id=$17, invoice_prefix=$18,
       proforma_prefix=$19, default_tax_rate=$20, default_due_days=$21, default_terms=$22,
       signatory_name=$23, updated_at=now()
     WHERE id = 1 RETURNING *`,
    [str(b.name) || "Chang IT Solutions", str(b.tagline), str(b.email), str(b.phone), str(b.website),
     str(b.address), str(b.state), str(b.stateCode), str(b.gstin).toUpperCase(), str(b.pan).toUpperCase(),
     str(b.logoUrl), str(b.bankName), str(b.bankAccountName), str(b.bankAccountNumber),
     str(b.bankIfsc).toUpperCase(), str(b.bankBranch), str(b.upiId), str(b.invoicePrefix) || "CIS-INV",
     str(b.proformaPrefix) || "CIS-PRO", num(b.defaultTaxRate, 18), Math.round(num(b.defaultDueDays, 15)),
     str(b.defaultTerms), str(b.signatoryName)]
  );
  res.json({ success: true, settings: toSettings(rows[0]) });
}));

app.get("/api/stats", handle(async (_req, res) => {
  const { rows } = await query(`
    SELECT
      COALESCE(SUM(grand_total) FILTER (WHERE doc_type='invoice' AND status <> 'cancelled'), 0) AS invoiced,
      COALESCE(SUM(grand_total) FILTER (WHERE doc_type='invoice' AND status = 'paid'), 0) AS paid,
      COALESCE(SUM(grand_total) FILTER (WHERE doc_type='invoice' AND status IN ('draft','sent')), 0) AS outstanding,
      COALESCE(SUM(grand_total) FILTER (WHERE doc_type='invoice' AND status = 'sent' AND due_date < CURRENT_DATE), 0) AS overdue,
      COUNT(*) FILTER (WHERE doc_type='invoice') AS invoice_count,
      COUNT(*) FILTER (WHERE doc_type='proforma') AS proforma_count,
      (SELECT COUNT(*) FROM clients) AS client_count
    FROM invoices`);
  const r = rows[0];
  res.json({ success: true, stats: {
    invoiced: Number(r.invoiced), paid: Number(r.paid), outstanding: Number(r.outstanding),
    overdue: Number(r.overdue), invoiceCount: Number(r.invoice_count),
    proformaCount: Number(r.proforma_count), clientCount: Number(r.client_count),
  } });
}));

// Clients
app.get("/api/clients", handle(async (req, res) => {
  const q = str(req.query.q);
  const { rows } = await query(
    `SELECT c.*, COUNT(i.id) AS invoice_count,
            COALESCE(SUM(i.grand_total) FILTER (WHERE i.doc_type='invoice' AND i.status <> 'cancelled'), 0) AS total_billed
     FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
     WHERE $1 = '' OR c.name ILIKE '%' || $1 || '%' OR c.company ILIKE '%' || $1 || '%' OR c.email ILIKE '%' || $1 || '%'
     GROUP BY c.id ORDER BY lower(c.name)`,
    [q]
  );
  res.json({ success: true, clients: rows.map(toClient) });
}));

const clientParams = (b) => [str(b.name), str(b.company), str(b.email), str(b.phone), str(b.address),
  str(b.gstin).toUpperCase(), str(b.state)];

app.post("/api/clients", handle(async (req, res) => {
  const params = clientParams(req.body || {});
  if (!params[0]) return res.status(400).json({ success: false, message: "Client name is required." });
  const { rows } = await query(
    `INSERT INTO clients (name, company, email, phone, address, gstin, state) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    params
  );
  res.status(201).json({ success: true, client: toClient(rows[0]) });
}));

app.put("/api/clients/:id", handle(async (req, res) => {
  const params = clientParams(req.body || {});
  if (!params[0]) return res.status(400).json({ success: false, message: "Client name is required." });
  const { rows } = await query(
    `UPDATE clients SET name=$1, company=$2, email=$3, phone=$4, address=$5, gstin=$6, state=$7, updated_at=now()
     WHERE id=$8 RETURNING *`,
    [...params, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: "Client not found." });
  res.json({ success: true, client: toClient(rows[0]) });
}));

app.delete("/api/clients/:id", handle(async (req, res) => {
  // Invoices keep their own copy of the client details, so history stays intact.
  const { rowCount } = await query("DELETE FROM clients WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ success: false, message: "Client not found." });
  res.json({ success: true });
}));

// Invoices & proformas
app.get("/api/invoices", handle(async (req, res) => {
  const type = ["invoice", "proforma"].includes(req.query.type) ? req.query.type : "";
  const status = ["draft", "sent", "paid", "cancelled"].includes(req.query.status) ? req.query.status : "";
  const q = str(req.query.q);
  const limit = Math.min(500, Math.max(1, Math.round(num(req.query.limit, 200))));
  const { rows } = await query(
    `SELECT * FROM invoices
     WHERE ($1 = '' OR doc_type = $1) AND ($2 = '' OR status = $2)
       AND ($3 = '' OR invoice_number ILIKE '%' || $3 || '%' OR client_name ILIKE '%' || $3 || '%'
            OR client_company ILIKE '%' || $3 || '%')
     ORDER BY issue_date DESC, created_at DESC LIMIT $4`,
    [type, status, q, limit]
  );
  res.json({ success: true, invoices: rows.map((r) => toInvoice(r)) });
}));

app.get("/api/invoices/next-number", handle(async (req, res) => {
  // Preview only — the number is reserved when the document is first saved.
  const type = req.query.type === "proforma" ? "proforma" : "invoice";
  const date = dateOrNull(req.query.date) || new Date().toISOString().slice(0, 10);
  const fy = fiscalYear(date);
  const seq = await query("SELECT last_value FROM number_sequences WHERE doc_type=$1 AND fiscal_year=$2", [type, fy]);
  const s = (await query("SELECT invoice_prefix, proforma_prefix FROM company_settings WHERE id = 1")).rows[0];
  const prefix = type === "proforma" ? s.proforma_prefix : s.invoice_prefix;
  const next = (seq.rows[0]?.last_value || 0) + 1;
  res.json({ success: true, invoiceNumber: `${prefix}/${fy}/${String(next).padStart(4, "0")}` });
}));

app.get("/api/invoices/:id", handle(async (req, res) => {
  const invoice = await loadInvoice(pool, req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: "Document not found." });
  res.json({ success: true, invoice });
}));

app.post("/api/invoices", handle(async (req, res) => {
  const inv = parseInvoiceBody(req.body);
  const invoice = await withTransaction(async (db) => loadInvoice(db, await insertInvoice(db, inv)));
  res.status(201).json({ success: true, invoice });
}));

app.put("/api/invoices/:id", handle(async (req, res) => {
  const inv = parseInvoiceBody(req.body);
  const invoice = await withTransaction(async (db) => {
    const existing = await db.query("SELECT invoice_number FROM invoices WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!existing.rowCount) return null;
    const totals = computeTotals(inv.items, inv.taxMode, inv.taxRate);
    const clientId = await resolveClient(db, inv);
    await db.query(
      `UPDATE invoices SET doc_type=$1, invoice_number=$2, status=$3, issue_date=$4, due_date=$5, client_id=$6,
         client_name=$7, client_company=$8, client_email=$9, client_phone=$10, client_address=$11,
         client_gstin=$12, place_of_supply=$13, tax_mode=$14, tax_rate=$15, subtotal=$16, discount_total=$17,
         tax_total=$18, grand_total=$19, notes=$20, terms=$21, updated_at=now()
       WHERE id=$22`,
      [inv.type, inv.invoiceNumber || existing.rows[0].invoice_number, inv.status, inv.date, inv.dueDate,
       clientId, inv.clientName, inv.clientCompany, inv.clientEmail, inv.clientPhone, inv.clientAddress,
       inv.clientGstin, inv.placeOfSupply, inv.taxMode, inv.taxRate, totals.subtotal, totals.discountTotal,
       totals.taxTotal, totals.grandTotal, inv.notes, inv.terms, req.params.id]
    );
    await syncRenewals(db, req.params.id, inv, clientId);
    await writeItems(db, req.params.id, inv.items);
    return loadInvoice(db, req.params.id);
  });
  if (!invoice) return res.status(404).json({ success: false, message: "Document not found." });
  res.json({ success: true, invoice });
}));

app.patch("/api/invoices/:id/status", handle(async (req, res) => {
  const status = req.body?.status;
  if (!["draft", "sent", "paid", "cancelled"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }
  const { rowCount } = await query("UPDATE invoices SET status=$1, updated_at=now() WHERE id=$2", [status, req.params.id]);
  if (!rowCount) return res.status(404).json({ success: false, message: "Document not found." });
  res.json({ success: true, invoice: await loadInvoice(pool, req.params.id) });
}));

/** Copy a document. `convert` turns a proforma into a tax invoice linked to it. */
const copyDocument = (convert) => handle(async (req, res) => {
  const invoice = await withTransaction(async (db) => {
    const source = await loadInvoice(db, req.params.id);
    if (!source) return null;
    const today = new Date().toISOString().slice(0, 10);
    const inv = parseInvoiceBody({
      ...source,
      type: convert ? "invoice" : source.type,
      status: "draft",
      invoiceNumber: "",
      date: today,
      dueDate: "",
    });
    if (!convert) {
      inv.items = inv.items.map((i) => ({ ...i, renewalId: null, nextRenewalDate: null }));
    }
    if (source.dueDate) {
      const days = Math.round((new Date(source.dueDate) - new Date(source.date)) / 86_400_000);
      inv.dueDate = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    }
    const id = await insertInvoice(db, inv, { convertedFrom: convert ? source.id : null });
    return loadInvoice(db, id);
  });
  if (!invoice) return res.status(404).json({ success: false, message: "Document not found." });
  res.status(201).json({ success: true, invoice });
});

app.post("/api/invoices/:id/duplicate", copyDocument(false));
app.post("/api/invoices/:id/convert", copyDocument(true));

app.delete("/api/invoices/:id", handle(async (req, res) => {
  const { rowCount } = await query("DELETE FROM invoices WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ success: false, message: "Document not found." });
  res.json({ success: true });
}));

// ---------- Renewals & reminders ----------

const TODAY = "(now() AT TIME ZONE 'Asia/Kolkata')::date";
const CYCLE_INTERVAL = {
  monthly: "1 month",
  quarterly: "3 months",
  half_yearly: "6 months",
  yearly: "1 year",
  two_yearly: "2 years",
};
const CATEGORIES = ["domain", "hosting", "ssl", "amc", "software", "email", "cloud", "other"];
const RENEWAL_COLUMNS = `r.*, (r.next_renewal_date - ${TODAY}) AS days_left`;

const guessCategory = (text) => {
  const t = text.toLowerCase();
  if (/ssl|certificate/.test(t)) return "ssl";
  if (/domain|\.(in|com|net|org|co)\b/.test(t)) return "domain";
  if (/hosting|vps|server/.test(t)) return "hosting";
  if (/\bamc\b|maintenance|support/.test(t)) return "amc";
  if (/email|g ?suite|workspace|mailbox/.test(t)) return "email";
  if (/aws|azure|cloud|gcp/.test(t)) return "cloud";
  if (/licen[cs]e|subscription|software/.test(t)) return "software";
  return "other";
};

/**
 * Line items marked as recurring keep a renewal record in step with the invoice:
 * a new recurring item creates a renewal, a linked one moves its next renewal date,
 * and each link is logged in renewal_history. Mutates inv.items[].renewalId / nextRenewalDate.
 * Proformas only store the fields — renewals start when the tax invoice is raised.
 */
async function syncRenewals(db, invoiceId, inv, clientId) {
  const linked = [];
  for (const item of inv.items) {
    if (!item.renewalCycle) continue;
    const interval = CYCLE_INTERVAL[item.renewalCycle];
    if (!item.nextRenewalDate) {
      item.nextRenewalDate = (await db.query("SELECT ($1::date + $2::interval)::date AS d", [inv.date, interval])).rows[0].d;
    }
    if (inv.type !== "invoice") continue;

    const net = item.quantity * item.unitPrice * (1 - item.discountPct / 100);
    const withTax = inv.taxMode === "none" ? net : net * (1 + inv.taxRate / 100);
    const [firstLine, ...rest] = item.description.split("\n");
    const serviceName = (firstLine.split(" — renewal for")[0].trim() || "Recurring service").slice(0, 150);
    // Use the linked renewal, or the client's existing renewal for the same service (e.g. last year's invoice duplicated).
    const existing = item.renewalId
      ? (await db.query("SELECT id FROM renewals WHERE id = $1", [item.renewalId])).rows[0]
      : clientId
        ? (await db.query(
            `SELECT id FROM renewals WHERE client_id = $1 AND lower(service_name) = lower($2) AND status <> 'cancelled'
             ORDER BY next_renewal_date DESC LIMIT 1`,
            [clientId, serviceName]
          )).rows[0]
        : null;
    if (existing) item.renewalId = existing.id;

    if (existing) {
      // Only the newest invoice for a renewal may move its date (re-saving an old invoice must not roll it back).
      // A first-time link always moves it.
      const newer = await db.query(
        `SELECT 1 FROM renewal_history mine
         JOIN renewal_history other ON other.renewal_id = mine.renewal_id
          AND other.invoice_id IS NOT NULL AND other.invoice_id <> mine.invoice_id
          AND other.created_at > mine.created_at
         WHERE mine.renewal_id = $1 AND mine.invoice_id = $2
         LIMIT 1`,
        [existing.id, invoiceId]
      );
      if (!newer.rowCount) {
        await db.query(
          `UPDATE renewals SET billing_cycle = $2, next_renewal_date = $3, amount = $4, hsn_sac = $5,
             last_renewed_on = ${TODAY}, last_reminded_on = NULL, status = 'active', updated_at = now()
           WHERE id = $1`,
          [existing.id, item.renewalCycle, item.nextRenewalDate, round2(net), item.hsnSac]
        );
      }
    } else {
      const { rows } = await db.query(
        `INSERT INTO renewals (client_id, client_name, client_email, client_phone, service_name, category, description,
           hsn_sac, amount, billing_cycle, start_date, next_renewal_date, remind_days_before, last_renewed_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,15,${TODAY}) RETURNING id`,
        [clientId, inv.clientCompany || inv.clientName, inv.clientEmail, inv.clientPhone, serviceName,
         guessCategory(item.description), rest.join("\n").trim(), item.hsnSac, round2(net), item.renewalCycle,
         inv.date, item.nextRenewalDate]
      );
      item.renewalId = rows[0].id;
    }

    const historyParams = [item.renewalId, inv.date, item.nextRenewalDate, interval, round2(withTax), invoiceId];
    const updated = await db.query(
      `UPDATE renewal_history SET renewed_on = $2, period_from = ($3::date - $4::interval)::date,
         period_to = ($3::date - interval '1 day')::date, amount = $5
       WHERE renewal_id = $1 AND invoice_id = $6`,
      historyParams
    );
    if (!updated.rowCount) {
      await db.query(
        `INSERT INTO renewal_history (renewal_id, renewed_on, period_from, period_to, amount, invoice_id)
         VALUES ($1, $2, ($3::date - $4::interval)::date, ($3::date - interval '1 day')::date, $5, $6)`,
        historyParams
      );
    }
    linked.push(item.renewalId);
  }
  // Items no longer marked recurring drop out of the history for this invoice (the renewal itself is kept).
  await db.query(
    "DELETE FROM renewal_history WHERE invoice_id = $1 AND NOT (renewal_id = ANY($2::uuid[]))",
    [invoiceId, linked]
  );
}

const toRenewal = (r) => ({
  id: r.id, clientId: r.client_id, clientName: r.client_name, clientEmail: r.client_email,
  clientPhone: r.client_phone, serviceName: r.service_name, category: r.category,
  description: r.description, hsnSac: r.hsn_sac, amount: r.amount, billingCycle: r.billing_cycle,
  startDate: r.start_date || "", nextRenewalDate: r.next_renewal_date,
  remindDaysBefore: r.remind_days_before, status: r.status, notes: r.notes,
  lastRenewedOn: r.last_renewed_on || "", lastRemindedOn: r.last_reminded_on || "",
  daysLeft: r.days_left != null ? Number(r.days_left) : undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const parseRenewalBody = (b = {}) => ({
  clientId: str(b.clientId) || null,
  clientName: str(b.clientName),
  clientEmail: str(b.clientEmail),
  clientPhone: str(b.clientPhone),
  serviceName: str(b.serviceName),
  category: CATEGORIES.includes(b.category) ? b.category : "other",
  description: str(b.description),
  hsnSac: str(b.hsnSac),
  amount: Math.max(0, num(b.amount)),
  billingCycle: CYCLE_INTERVAL[b.billingCycle] ? b.billingCycle : "yearly",
  startDate: dateOrNull(b.startDate),
  nextRenewalDate: dateOrNull(b.nextRenewalDate),
  remindDaysBefore: Math.min(365, Math.max(0, Math.round(num(b.remindDaysBefore, 15)))),
  status: ["active", "paused", "cancelled"].includes(b.status) ? b.status : "active",
  notes: str(b.notes),
});

const validateRenewal = (r) =>
  !r.serviceName ? "Service name is required."
    : !r.clientName ? "Client name is required."
      : !r.nextRenewalDate ? "Next renewal date is required."
        : null;

const loadRenewal = async (db, id) => {
  const { rows } = await db.query(`SELECT ${RENEWAL_COLUMNS} FROM renewals r WHERE r.id = $1`, [id]);
  if (!rows.length) return null;
  const history = await db.query(
    `SELECT h.*, i.invoice_number FROM renewal_history h LEFT JOIN invoices i ON i.id = h.invoice_id
     WHERE h.renewal_id = $1 ORDER BY h.renewed_on DESC, h.id DESC`,
    [id]
  );
  return {
    ...toRenewal(rows[0]),
    history: history.rows.map((h) => ({
      id: Number(h.id), renewedOn: h.renewed_on, periodFrom: h.period_from, periodTo: h.period_to,
      amount: h.amount, invoiceId: h.invoice_id, invoiceNumber: h.invoice_number || "", note: h.note,
    })),
  };
};

const renewalParams = (r, clientId) => [clientId, r.clientName, r.clientEmail, r.clientPhone, r.serviceName,
  r.category, r.description, r.hsnSac, r.amount, r.billingCycle, r.startDate, r.nextRenewalDate,
  r.remindDaysBefore, r.status, r.notes];

const renewalClient = (db, r) =>
  resolveClient(db, { clientId: r.clientId, clientName: r.clientName, clientEmail: r.clientEmail,
    clientPhone: r.clientPhone, clientCompany: "", clientAddress: "", clientGstin: "", placeOfSupply: "" });

app.get("/api/renewals", handle(async (req, res) => {
  const status = ["active", "paused", "cancelled"].includes(req.query.status) ? req.query.status : "";
  const q = str(req.query.q);
  const { rows } = await query(
    `SELECT ${RENEWAL_COLUMNS} FROM renewals r
     WHERE ($1 = '' OR r.status = $1)
       AND ($2 = '' OR r.service_name ILIKE '%' || $2 || '%' OR r.client_name ILIKE '%' || $2 || '%'
            OR r.description ILIKE '%' || $2 || '%')
     ORDER BY (r.status = 'active') DESC, r.next_renewal_date ASC`,
    [status, q]
  );
  res.json({ success: true, renewals: rows.map(toRenewal) });
}));

app.get("/api/renewals/:id", handle(async (req, res) => {
  const renewal = await loadRenewal(pool, req.params.id);
  if (!renewal) return res.status(404).json({ success: false, message: "Renewal not found." });
  res.json({ success: true, renewal });
}));

app.post("/api/renewals", handle(async (req, res) => {
  const r = parseRenewalBody(req.body);
  const problem = validateRenewal(r);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const renewal = await withTransaction(async (db) => {
    const clientId = await renewalClient(db, r);
    const { rows } = await db.query(
      `INSERT INTO renewals (client_id, client_name, client_email, client_phone, service_name, category,
         description, hsn_sac, amount, billing_cycle, start_date, next_renewal_date, remind_days_before, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      renewalParams(r, clientId)
    );
    return loadRenewal(db, rows[0].id);
  });
  res.status(201).json({ success: true, renewal });
}));

app.put("/api/renewals/:id", handle(async (req, res) => {
  const r = parseRenewalBody(req.body);
  const problem = validateRenewal(r);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const renewal = await withTransaction(async (db) => {
    const clientId = await renewalClient(db, r);
    const { rowCount } = await db.query(
      `UPDATE renewals SET client_id=$1, client_name=$2, client_email=$3, client_phone=$4, service_name=$5,
         category=$6, description=$7, hsn_sac=$8, amount=$9, billing_cycle=$10, start_date=$11,
         next_renewal_date=$12, remind_days_before=$13, status=$14, notes=$15, updated_at=now()
       WHERE id=$16`,
      [...renewalParams(r, clientId), req.params.id]
    );
    return rowCount ? loadRenewal(db, req.params.id) : null;
  });
  if (!renewal) return res.status(404).json({ success: false, message: "Renewal not found." });
  res.json({ success: true, renewal });
}));

app.delete("/api/renewals/:id", handle(async (req, res) => {
  const { rowCount } = await query("DELETE FROM renewals WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ success: false, message: "Renewal not found." });
  res.json({ success: true });
}));

/** Record one renewal: log the period covered and move the next renewal date forward by one cycle. */
app.post("/api/renewals/:id/renew", handle(async (req, res) => {
  const invoiceId = str(req.body?.invoiceId) || null;
  const note = str(req.body?.note);
  const renewal = await withTransaction(async (db) => {
    const { rows } = await db.query("SELECT * FROM renewals WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!rows.length) return null;
    const r = rows[0];
    const interval = CYCLE_INTERVAL[r.billing_cycle];
    const amount = invoiceId
      ? (await db.query("SELECT grand_total FROM invoices WHERE id = $1", [invoiceId])).rows[0]?.grand_total ?? r.amount
      : r.amount;
    await db.query(
      `INSERT INTO renewal_history (renewal_id, renewed_on, period_from, period_to, amount, invoice_id, note)
       VALUES ($1, ${TODAY}, $2::date, ($2::date + $3::interval - interval '1 day')::date, $4, $5, $6)`,
      [r.id, r.next_renewal_date, interval, amount, invoiceId, note]
    );
    await db.query(
      `UPDATE renewals SET next_renewal_date = (next_renewal_date + $2::interval)::date,
         last_renewed_on = ${TODAY}, last_reminded_on = NULL, status = 'active', updated_at = now()
       WHERE id = $1`,
      [r.id, interval]
    );
    return loadRenewal(db, r.id);
  });
  if (!renewal) return res.status(404).json({ success: false, message: "Renewal not found." });
  res.json({ success: true, renewal });
}));

app.post("/api/renewals/:id/reminded", handle(async (req, res) => {
  const { rowCount } = await query(
    `UPDATE renewals SET last_reminded_on = ${TODAY}, updated_at = now() WHERE id = $1`, [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ success: false, message: "Renewal not found." });
  res.json({ success: true });
}));

/** Everything that needs attention now: renewals inside their reminder window and invoices due soon or overdue. */
app.get("/api/reminders", handle(async (_req, res) => {
  const renewals = await query(
    `SELECT ${RENEWAL_COLUMNS} FROM renewals r
     WHERE r.status = 'active' AND r.next_renewal_date - r.remind_days_before <= ${TODAY}
     ORDER BY r.next_renewal_date ASC`
  );
  const invoices = await query(
    `SELECT *, (due_date - ${TODAY}) AS days_left FROM invoices
     WHERE doc_type = 'invoice' AND status IN ('draft','sent') AND due_date IS NOT NULL
       AND due_date <= ${TODAY} + 7
     ORDER BY due_date ASC`
  );
  const upcoming = await query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM renewals
     WHERE status = 'active' AND next_renewal_date BETWEEN ${TODAY} AND ${TODAY} + 30`
  );
  res.json({
    success: true,
    renewals: renewals.rows.map(toRenewal),
    invoices: invoices.rows.map((r) => ({ ...toInvoice(r), daysLeft: Number(r.days_left) })),
    next30Days: { count: Number(upcoming.rows[0].n), amount: Number(upcoming.rows[0].total) },
  });
}));

app.use("/api", (_req, res) => res.status(404).json({ success: false, message: "Not found." }));

// Serve the built front end (npm run build) from the same server in production.
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
}

const PORT = process.env.PORT || 4000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Invoice API running on http://localhost:${PORT} (database: ${process.env.PGDATABASE})`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to PostgreSQL or create tables:", error.message);
    process.exit(1);
  });
