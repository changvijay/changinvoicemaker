import pg from "pg";
import { readFileSync } from "fs";
import "dotenv/config";

// Return NUMERIC columns as JS numbers and DATE columns as plain "YYYY-MM-DD" strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);

const sslMode = (process.env.PGSSLMODE || "require").toLowerCase();
let ssl = false;
if (sslMode !== "disable") {
  ssl = process.env.PGSSLROOTCERT
    ? { ca: readFileSync(process.env.PGSSLROOTCERT, "utf-8"), rejectUnauthorized: true }
    : { rejectUnauthorized: false }; // "require": encrypted, server cert not verified
}

export const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "chang_invoices",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS company_settings (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name                TEXT NOT NULL DEFAULT 'Chang IT Solutions',
  tagline             TEXT NOT NULL DEFAULT 'Custom Software • CRM • ERP • Cloud',
  email               TEXT NOT NULL DEFAULT 'info@changtechs.com',
  phone               TEXT NOT NULL DEFAULT '+91 7010747878',
  website             TEXT NOT NULL DEFAULT 'changtechs.com',
  address             TEXT NOT NULL DEFAULT E'109, Pillayar Kovil St., Kalathur\\nRanipet, Tamil Nadu 632531, India',
  state               TEXT NOT NULL DEFAULT 'Tamil Nadu',
  state_code          TEXT NOT NULL DEFAULT '33',
  gstin               TEXT NOT NULL DEFAULT '',
  pan                 TEXT NOT NULL DEFAULT '',
  logo_url            TEXT NOT NULL DEFAULT 'https://changtechs.com/logo.png',
  bank_name           TEXT NOT NULL DEFAULT '',
  bank_account_name   TEXT NOT NULL DEFAULT 'Chang IT Solutions',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_ifsc           TEXT NOT NULL DEFAULT '',
  bank_branch         TEXT NOT NULL DEFAULT '',
  upi_id              TEXT NOT NULL DEFAULT '',
  invoice_prefix      TEXT NOT NULL DEFAULT 'CIS-INV',
  proforma_prefix     TEXT NOT NULL DEFAULT 'CIS-PRO',
  default_tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 18,
  default_due_days    INTEGER NOT NULL DEFAULT 15,
  default_terms       TEXT NOT NULL DEFAULT E'1. Payment is due within 15 days of the invoice date.\\n2. Please quote the invoice number with your payment.\\n3. Interest at 18% p.a. may be charged on overdue amounts.',
  signatory_name      TEXT NOT NULL DEFAULT 'Authorised Signatory',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  company     TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  gstin       TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (lower(name));

CREATE TABLE IF NOT EXISTS number_sequences (
  doc_type    TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  last_value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, fiscal_year)
);

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type         TEXT NOT NULL CHECK (doc_type IN ('invoice','proforma')),
  invoice_number   TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name      TEXT NOT NULL DEFAULT '',
  client_company   TEXT NOT NULL DEFAULT '',
  client_email     TEXT NOT NULL DEFAULT '',
  client_phone     TEXT NOT NULL DEFAULT '',
  client_address   TEXT NOT NULL DEFAULT '',
  client_gstin     TEXT NOT NULL DEFAULT '',
  place_of_supply  TEXT NOT NULL DEFAULT '',
  tax_mode         TEXT NOT NULL DEFAULT 'cgst_sgst' CHECK (tax_mode IN ('cgst_sgst','igst','none')),
  tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 18,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  terms            TEXT NOT NULL DEFAULT '',
  converted_from   UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_type_date_idx ON invoices (doc_type, issue_date DESC);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices (client_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id            BIGSERIAL PRIMARY KEY,
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  hsn_sac       TEXT NOT NULL DEFAULT '',
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (invoice_id, position);

-- Recurring client services (domain, hosting, SSL, AMC, licences…) that need renewing.
CREATE TABLE IF NOT EXISTS renewals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name        TEXT NOT NULL DEFAULT '',
  client_email       TEXT NOT NULL DEFAULT '',
  client_phone       TEXT NOT NULL DEFAULT '',
  service_name       TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'other'
                     CHECK (category IN ('domain','hosting','ssl','amc','software','email','cloud','other')),
  description        TEXT NOT NULL DEFAULT '',
  hsn_sac            TEXT NOT NULL DEFAULT '',
  amount             NUMERIC(14,2) NOT NULL DEFAULT 0,
  billing_cycle      TEXT NOT NULL DEFAULT 'yearly'
                     CHECK (billing_cycle IN ('monthly','quarterly','half_yearly','yearly','two_yearly')),
  start_date         DATE,
  next_renewal_date  DATE NOT NULL,
  remind_days_before INTEGER NOT NULL DEFAULT 15 CHECK (remind_days_before BETWEEN 0 AND 365),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  notes              TEXT NOT NULL DEFAULT '',
  last_renewed_on    DATE,
  last_reminded_on   DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS renewals_next_idx ON renewals (status, next_renewal_date);
CREATE INDEX IF NOT EXISTS renewals_client_idx ON renewals (client_id);

-- One row each time a service is renewed: the period it covers and the invoice raised for it.
CREATE TABLE IF NOT EXISTS renewal_history (
  id           BIGSERIAL PRIMARY KEY,
  renewal_id   UUID NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
  renewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from  DATE NOT NULL,
  period_to    DATE NOT NULL,
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_id   UUID REFERENCES invoices(id) ON DELETE SET NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS renewal_history_renewal_idx ON renewal_history (renewal_id, renewed_on DESC);
CREATE INDEX IF NOT EXISTS renewal_history_invoice_idx ON renewal_history (invoice_id);

-- A line item can be a recurring service: its cycle, next renewal date and the renewal it keeps up to date.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS renewal_cycle TEXT
  CHECK (renewal_cycle IN ('monthly','quarterly','half_yearly','yearly','two_yearly'));
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS next_renewal_date DATE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS renewal_id UUID REFERENCES renewals(id) ON DELETE SET NULL;
`;

export const migrate = async () => {
  await pool.query(SCHEMA);
};
