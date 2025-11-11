import express from "express";
import cors from "cors";
import { promises as fs, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "invoices.json");

const ensureDataFile = async () => {
  try {
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      await fs.writeFile(DATA_FILE, "[]", "utf-8");
    }
  } catch (error) {
    console.error("Failed to ensure data file", error);
    throw error;
  }
};

const readInvoices = async () => {
  await ensureDataFile();
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    const invoices = JSON.parse(content);
    return Array.isArray(invoices) ? invoices : [];
  } catch (error) {
    console.error("Failed to read invoices", error);
    throw error;
  }
};

const writeInvoices = async (invoices) => {
  await ensureDataFile();
  const payload = JSON.stringify(invoices, null, 2);
  await fs.writeFile(DATA_FILE, payload, "utf-8");
};

const normaliseInvoice = (invoice) => {
  const now = new Date().toISOString();
  return {
    ...invoice,
    id: invoice?.id || randomUUID(),
    createdAt: invoice?.createdAt || now,
    items: Array.isArray(invoice?.items) ? invoice.items : [],
    type: invoice?.type === "proforma" ? "proforma" : "invoice",
  };
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/invoices", async (_req, res) => {
  try {
    const invoices = await readInvoices();
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load invoices" });
  }
});

app.post("/api/invoices", async (req, res) => {
  try {
    const incoming = normaliseInvoice(req.body || {});
    const invoices = await readInvoices();
    const idx = invoices.findIndex((inv) => inv.id === incoming.id);

    let savedInvoice;
    if (idx >= 0) {
      savedInvoice = { ...invoices[idx], ...incoming, updatedAt: new Date().toISOString() };
      invoices[idx] = savedInvoice;
    } else {
      savedInvoice = { ...incoming, updatedAt: new Date().toISOString() };
      invoices.push(savedInvoice);
    }

    await writeInvoices(invoices);
    res.json({ success: true, invoice: savedInvoice });
  } catch (error) {
    console.error("Failed to save invoice", error);
    res.status(500).json({ success: false, message: "Failed to save invoice" });
  }
});

app.delete("/api/invoices/:id", async (req, res) => {
  try {
    const invoices = await readInvoices();
    const filtered = invoices.filter((inv) => inv.id !== req.params.id);

    if (filtered.length === invoices.length) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    await writeInvoices(filtered);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice", error);
    res.status(500).json({ success: false, message: "Failed to delete invoice" });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Invoice API server running on http://localhost:${PORT}`);
});
