import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import {
  categorizeTransaction,
  loadReferenceData,
} from "./transaction_processing.js";

// --- CONFIG ---
const INPUT_CSV = "src/lib/bank_transactions.csv";
const OUTPUT_CSV = "categorized_transactions.csv";

// --- Helper: Find header row ---
function findHeaderRow(records) {
  for (let i = 0; i < records.length; i++) {
    const row = records[i].map((h) => h.toLowerCase());
    if (
      row.includes("balance") &&
      (row.includes("date") ||
        row.includes("amount") ||
        row.includes("debit") ||
        row.includes("credit"))
    ) {
      return i;
    }
  }
  throw new Error("Header row not found");
}

// --- Helper: Normalize amount ---
function getAmount(row, headers) {
  // Prefer a single "amount" column if present
  const amountIdx = headers.findIndex((h) => h.toLowerCase() === "amount");
  if (amountIdx !== -1) {
    const val = row[amountIdx];
    if (val !== undefined && val !== null && val !== "") {
      return parseFloat(val);
    }
  }

  // Otherwise, look for "amount debit" and "amount credit" columns
  const debitIdx = headers.findIndex((h) =>
    h.toLowerCase().includes("amount debit")
  );
  const creditIdx = headers.findIndex((h) =>
    h.toLowerCase().includes("amount credit")
  );

  if (debitIdx !== -1 && row[debitIdx] && row[debitIdx].trim() !== "") {
    return parseFloat(row[debitIdx]);
  }
  if (creditIdx !== -1 && row[creditIdx] && row[creditIdx].trim() !== "") {
    return parseFloat(row[creditIdx]);
  }

  // If neither, return null
  return null;
}

// --- Main ---
(async () => {
  await loadReferenceData();

  const csvContent = fs.readFileSync(INPUT_CSV, "utf8");
  const records = parse(csvContent, { relax_column_count: true });

  const headerRowIdx = findHeaderRow(records);
  const headers = records[headerRowIdx];
  const dataRows = records
    .slice(headerRowIdx + 1)
    .filter((row) => row.length >= headers.length);

  // Find relevant column indices
  const descIdx = headers.findIndex((h) =>
    h.toLowerCase().includes("description")
  );
  const txnIdx = headers.findIndex((h) =>
    h.toLowerCase().includes("transaction")
  );
  // Memo is optional
  // Other fields can be added as needed

  const output = [
    [
      "Transaction Number",
      "original_description",
      "amount",
      "merchant_id",
      "clean_description",
      "category_id",
      "category_name",
      "confidence",
      "needs_review",
      "match_type",
      "logo_url", // <-- Add logo_url to header
    ],
  ];

  for (const row of dataRows) {
    const description = row[descIdx];
    const txnNumber = txnIdx !== -1 ? row[txnIdx] : "";
    const amount = getAmount(row, headers);
    const result = await categorizeTransaction(description);

    output.push([
      txnNumber,
      description,
      amount,
      result.merchant_id || "",
      result.clean_description || "",
      result.category_id || "",
      result.category_name || "",
      result.confidence,
      result.needs_review,
      result.match_type,
      result.logo_url || "", // <-- Add logo_url to output row
    ]);
  }

  const csvOut = stringify(output);
  fs.writeFileSync(OUTPUT_CSV, csvOut);
  console.log(`Categorized transactions written to ${OUTPUT_CSV}`);
})();
