export interface CSVRow {
  [key: string]: string;
}

export interface HeaderDetectionResult {
  headerRowIndex: number;
  confidence: number;
  headers: string[];
  reason: string;
}

export interface ColumnMapping {
  transactionNumber?: string;
  description?: string;
  date?: string;
  amountColumns: string[];
  balance?: string;
  customFields: { [fieldName: string]: string };
}

export function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    // Simple CSV parsing - handles quoted fields
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current.trim());
    result.push(row);
  }
  
  return result;
}

export function detectHeaderRow(rows: string[][]): HeaderDetectionResult {
  if (rows.length === 0) {
    return {
      headerRowIndex: 0,
      confidence: 0,
      headers: [],
      reason: 'No data found'
    };
  }

  const results: HeaderDetectionResult[] = [];
  
  // Check each row up to row 10 for potential headers
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    let score = 0;
    const reasons: string[] = [];
    
    // Check for common financial terms
    const financialTerms = [
      'transaction', 'amount', 'date', 'description', 'balance', 
      'credit', 'debit', 'reference', 'type', 'account', 'memo',
      'payee', 'category', 'id', 'number'
    ];
    
    row.forEach(cell => {
      const cellLower = cell.toLowerCase().replace(/[^a-z]/g, '');
      
      // Check if cell contains financial terms
      for (const term of financialTerms) {
        if (cellLower.includes(term)) {
          score += 10;
          reasons.push(`Contains "${term}"`);
          break;
        }
      }
      
      // Check if it's mostly text (good for headers)
      if (cell.length > 0 && isNaN(Number(cell))) {
        score += 2;
      }
      
      // Check if it has reasonable length for header
      if (cell.length > 2 && cell.length < 50) {
        score += 1;
      }
    });
    
    // Penalize rows with too many numbers
    const numericCells = row.filter(cell => !isNaN(Number(cell)) && cell.trim() !== '').length;
    if (numericCells > row.length * 0.5) {
      score -= 20;
      reasons.push('Too many numeric values');
    }
    
    // Bonus for being after some metadata rows (common in bank CSVs)
    if (i >= 2 && i <= 5) {
      score += 5;
      reasons.push('Located in typical header position');
    }
    
    results.push({
      headerRowIndex: i,
      confidence: score,
      headers: row,
      reason: reasons.join(', ') || 'Standard scoring'
    });
  }
  
  // Return the row with highest confidence
  const best = results.reduce((prev, current) => 
    current.confidence > prev.confidence ? current : prev
  );
  
  return best;
}

export function getColumnSuggestions(headers: string[]): Partial<ColumnMapping> {
  const suggestions: Partial<ColumnMapping> = {
    amountColumns: []
  };
  
  headers.forEach(header => {
    const headerLower = header.toLowerCase().replace(/[^a-z]/g, '');
    
    // Transaction number/ID patterns
    if (!suggestions.transactionNumber && 
        (headerLower.includes('transaction') || headerLower.includes('reference') || 
         headerLower.includes('id') || headerLower.includes('number'))) {
      suggestions.transactionNumber = header;
    }
    
    // Description patterns
    if (!suggestions.description && 
        (headerLower.includes('description') || headerLower.includes('memo') || 
         headerLower.includes('payee') || headerLower.includes('details'))) {
      suggestions.description = header;
    }
    
    // Date patterns
    if (!suggestions.date && 
        (headerLower.includes('date') || headerLower.includes('time'))) {
      suggestions.date = header;
    }
    
    // Balance patterns (separate from amount)
    if (!suggestions.balance && headerLower.includes('balance')) {
      suggestions.balance = header;
    }
    
    // Amount patterns (excluding balance)
    if ((headerLower.includes('amount') || headerLower.includes('credit') || 
         headerLower.includes('debit')) && !headerLower.includes('balance')) {
      suggestions.amountColumns!.push(header);
    }
  });
  
  return suggestions;
}

export function detectBalanceColumn(headers: string[]): string | null {
  for (const header of headers) {
    const headerLower = header.toLowerCase().replace(/[^a-z]/g, '');
    if (headerLower.includes('balance')) {
      return header;
    }
  }
  return null;
}

export function hasBalanceColumn(headers: string[]): boolean {
  return detectBalanceColumn(headers) !== null;
}

export function parseAmount(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  
  // Remove currency symbols, commas, and extra spaces
  const cleanValue = value.replace(/[$,\s]/g, '').trim();
  
  // Handle parentheses as negative (common accounting format)
  if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
    const numberPart = cleanValue.slice(1, -1);
    return -parseFloat(numberPart) || 0;
  }
  
  return parseFloat(cleanValue) || 0;
}

export function combineAmounts(amounts: { [column: string]: string }, headers: string[]): number {
  let totalAmount = 0;
  
  Object.entries(amounts).forEach(([columnName, value]) => {
    const columnLower = columnName.toLowerCase();
    const parsedAmount = parseAmount(value);
    
    if (parsedAmount === 0 && value.trim() === '') return; // Skip empty values
    
    // Determine if this is a credit or debit column
    if (columnLower.includes('debit') || columnLower.includes('withdrawal') ||
        columnLower.includes('payment') || columnLower.includes('outgoing') ||
        columnLower.includes('expense') || columnLower.includes('out')) {
      // Debit amounts should be negative (subtract from balance)
      totalAmount += parsedAmount > 0 ? -Math.abs(parsedAmount) : parsedAmount;
    } else if (columnLower.includes('credit') || columnLower.includes('deposit') ||
               columnLower.includes('incoming') || columnLower.includes('received') ||
               columnLower.includes('income') || columnLower.includes('in')) {
      // Credit amounts should be positive (add to balance)
      totalAmount += Math.abs(parsedAmount);
    } else {
      // For general "amount" columns, keep the sign as-is
      // This handles cases where the CSV already has proper +/- signs
      totalAmount += parsedAmount;
    }
  });
  
  return totalAmount;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function validateMapping(mapping: ColumnMapping, headers: string[]): string[] {
  const errors: string[] = [];
  
  if (!mapping.transactionNumber) {
    errors.push('Transaction Number field is required');
  }
  
  if (!mapping.description) {
    errors.push('Description field is required');
  }
  
  if (!mapping.date) {
    errors.push('Date field is required');
  }
  
  if (mapping.amountColumns.length === 0) {
    errors.push('At least one amount column is required');
  }
  
  // Check if balance is required (when balance column exists in headers)
  if (hasBalanceColumn(headers) && !mapping.balance) {
    errors.push('Balance field is required');
  }
  
  // Check if mapped columns exist in headers
  const allMappedColumns = [
    mapping.transactionNumber,
    mapping.description,
    mapping.date,
    mapping.balance,
    ...mapping.amountColumns,
    ...Object.values(mapping.customFields)
  ].filter(Boolean);
  
  allMappedColumns.forEach(column => {
    if (column && !headers.includes(column)) {
      errors.push(`Column "${column}" not found in CSV headers`);
    }
  });
  
  return errors;
}