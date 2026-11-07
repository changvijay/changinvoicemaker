# Chang IT Solutions — Invoice Maker

Professional GST invoices and proforma invoices for **Chang IT Solutions** ([changtechs.com](https://changtechs.com)).

Invoices are **stored as data in PostgreSQL, not as files**. Open any saved document at any time to edit it and
print / save it as PDF again — the PDF is generated fresh from the database every time.

## Features

- Tax invoices and proforma invoices with automatic numbering per Indian financial year
  (`CIS-INV/2026-27/0001`, `CIS-PRO/2026-27/0001`)
- GST: CGST + SGST (same state), IGST (other state) or no tax; HSN/SAC, quantity, rate and discount per line
- Amount in words (Indian numbering — lakh / crore), bank & UPI details, terms, authorised signatory block
- Status tracking: draft, sent, paid, cancelled (overdue is shown automatically)
- Convert a proforma into a tax invoice, or duplicate any document
- Client book — clients are saved automatically the first time you bill them
- Dashboard with invoiced / received / outstanding / overdue totals
- **Renewals** — track clients' recurring services (domain, hosting, SSL, AMC, licences, cloud) with billing cycle,
  amount and next renewal date; one click raises the renewal invoice, moves the next date forward and keeps a renewal history
- **Reminders** on the dashboard — renewals inside their reminder window and invoices due within 7 days or overdue,
  with pre-written email / WhatsApp reminder messages (opened in your own mail app or WhatsApp; nothing is sent automatically)
- Company settings (address, GSTIN, PAN, bank, prefixes, default terms) editable in the app
- Clean A4 print layout — use **Print / PDF** and choose "Save as PDF"

## Setup

1. Install dependencies

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your PostgreSQL connection (Aiven works out of the box).
   The database (default name `chang_invoices`) must exist; the tables are created automatically on first start.

3. Run the app (API on port 4000 + web on port 8080)

   ```sh
   npm run dev
   ```

   Open http://localhost:8080.

## Production

```sh
npm run build   # builds the web app into dist/
npm start       # one server: API + web app on PORT (default 4000)
```

## Database tables

| Table              | Holds                                                        |
| ------------------ | ------------------------------------------------------------ |
| `company_settings` | Your company details, bank info, prefixes, default terms (1 row) |
| `clients`          | Saved clients                                                |
| `invoices`         | One row per invoice / proforma, with a copy of the client details and stored totals |
| `invoice_items`    | Line items for each invoice                                  |
| `renewals`         | Recurring client services and their next renewal date        |
| `renewal_history`  | Each renewal: period covered, amount and linked invoice      |
| `number_sequences` | Last used number per document type and financial year       |

## Security

`.env` holds your database password and is git-ignored — never commit it. With `PGSSLMODE=require` the connection
is encrypted; to also verify the server certificate, download the CA certificate from the Aiven console and set
`PGSSLROOTCERT=./ca.pem`.
