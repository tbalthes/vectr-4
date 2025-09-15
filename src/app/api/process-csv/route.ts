import { readFile } from 'fs/promises';
import { join } from 'path';

import { NextResponse } from 'next/server';

interface NormalizedTransaction {
  transaction_number: string;
  date: string;
  description: string;
  clean_description?: string;
  amount: number;
  category: string;
  source: string;
  original_description: string;
  vendor: string;
  amount_debit: string;
  amount_credit: string;
  [key: string]: string | number | undefined;
}

export async function POST() {
  try {
    // Read the CSV file
    const csvPath = join(
      process.cwd(),
      'src',
      'app',
      'api',
      'process-csv',
      'Spending Breakdown - Arizona Federal CU (2).csv',
    );
    const csvContent = await readFile(csvPath, 'utf-8');

    // Parse CSV lines
    const lines = csvContent.split('\n').filter((line) => line.trim());
    const headers = parseCSVLine(lines[0]);

    // Process each transaction
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < headers.length) {
        continue;
      } // Skip incomplete rows

      const transaction: Record<string, string> = {};
      headers.forEach((header, index) => {
        transaction[header] = values[index] || '';
      });

      // Normalize the transaction
      const normalized = normalizeTransaction(transaction);
      if (normalized) {
        transactions.push(normalized);
      }
    }

    // Extract original descriptions for cleaning (Pe field, not Vendor)
    const originalDescriptions = transactions.map((t) => t.original_description);

    // Call Python backend to clean the original descriptions
    const cleanedDescriptions = await cleanDescriptionsWithPython(originalDescriptions);

    // Update transactions with cleaned descriptions while preserving original_description
    transactions.forEach((transaction, index) => {
      if (cleanedDescriptions[index]) {
        // Ensure we preserve the original_description and only set clean_description
        const originalDesc = transaction.original_description; // Save it first
        transaction.clean_description = cleanedDescriptions[index].cleaned;
        transaction.original_description = originalDesc; // Restore it to be safe
      }
    });

    // Generate normalized CSV
    const normalizedCSV = generateCSV(transactions);

    return new NextResponse(normalizedCSV, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="normalized_transactions.csv"',
      },
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json({ error: 'Failed to process CSV file' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeTransaction(transaction: Record<string, string>): NormalizedTransaction | null {
  // Skip header rows or invalid rows
  if (!transaction.Date || transaction.Date === 'Date') {
    return null;
  }

  // Extract basic information
  const date = normalizeDate(transaction.Date);
  const description = transaction.Vendor || ''; // Use Vendor for clean description
  const category = transaction.Category || '';
  const originalDescription = transaction.Pe || ''; // Pe contains full raw transaction text

  // Debug logging for Amazon transactions
  if (description.toLowerCase().includes('amazon')) {
    console.log('Amazon transaction debug:', {
      vendor: transaction.Vendor,
      pe: transaction.Pe,
      originalDescription: originalDescription,
    });
  }

  // Handle amounts - check both debit and credit columns
  let amount = 0;
  let amountStr = '';

  if (transaction['Amount Debit'] && transaction['Amount Debit'].trim() !== '') {
    amountStr = transaction['Amount Debit'].replace(/[$,]/g, '');
    amount = parseFloat(amountStr) || 0;
    // Debit amounts should be negative if not already
    if (amount > 0) {
      amount = -amount;
    }
  } else if (transaction['Amount Credit'] && transaction['Amount Credit'].trim() !== '') {
    amountStr = transaction['Amount Credit'].replace(/[$,]/g, '');
    amount = parseFloat(amountStr) || 0;
    // Credit amounts should be positive
    if (amount < 0) {
      amount = -amount;
    }
  }

  // Generate transaction number (simple incrementing or use row index)
  const transactionNumber = Date.now() + Math.random();

  return {
    transaction_number: transactionNumber.toString(),
    date: date,
    description: description,
    amount: amount,
    category: category,
    source: transaction['Transaction Source'] || '',
    original_description: transaction.Pe || '', // Full raw transaction description
    vendor: transaction.Vendor || '',
    amount_debit: transaction['Amount Debit'] || '',
    amount_credit: transaction['Amount Credit'] || '',
  };
}

function normalizeDate(dateStr: string): string {
  // Handle various date formats
  try {
    // Assuming format like "6/13/2025"
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function generateCSV(transactions: NormalizedTransaction[]): string {
  if (transactions.length === 0) {
    return 'No transactions to process';
  }

  // CSV headers
  const headers = [
    'transaction_number',
    'date',
    'description',
    'clean_description',
    'amount',
    'category',
    'source',
    'original_description',
    'vendor',
    'amount_debit',
    'amount_credit',
  ];

  // Generate CSV content
  const csvLines = [headers.join(',')];

  transactions.forEach((transaction) => {
    const row = headers.map((header) => {
      let value = transaction[header] || '';
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

async function cleanDescriptionsWithPython(descriptions: string[]) {
  try {
    console.log('Sending descriptions to Python:', descriptions.slice(0, 5)); // Log first 5

    const response = await fetch('http://localhost:8000/normalize/descriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ descriptions }),
    });

    if (!response.ok) {
      throw new Error(`Python backend error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Received from Python:', result.cleaned_descriptions.slice(0, 5)); // Log first 5
    return result.cleaned_descriptions;
  } catch (error) {
    console.error('Error calling Python backend:', error);
    // Fallback to original descriptions if Python backend fails
    return descriptions.map((desc) => ({
      original: desc,
      cleaned: desc.toLowerCase(),
    }));
  }
}
