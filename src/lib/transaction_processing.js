import "dotenv/config";
console.log(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
import { createClient } from "@supabase/supabase-js";
import Fuse from "fuse.js";

// --- Supabase setup ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- In-memory cache ---
let merchants = [];
let categories = [];
let mccCategoryMap = [];

// --- Normalization Module ---
function normalizeMerchantName(raw) {
  if (!raw) return null;

  let normalized = raw;

  // Remove everything before and including the first asterisk (e.g., "SQ *THE WANDERING TURTLE" -> "THE WANDERING TURTLE")
  normalized = normalized.replace(/^[^*]*\*\s*/g, "").replace(/^[^*]*\*/g, "");

  // Protect known hyphenated brands before other replacements
  normalized = normalized.replace(/IN-N-OUT/gi, "INNOUT");

  // Remove www. and .com/.net/.org/.io/.ai etc.
  normalized = normalized
    .replace(/\bwww\./gi, " ")
    .replace(
      /\.(com|net|org|io|ai|co|gov|edu|us|ca|uk|de|fr|jp|au|info|biz|tv|me|ly|app|dev|shop|store|cloud|xyz|site|online)\b/gi,
      " "
    );

  // Remove generic stopwords but NOT card brands or "IN" if followed by "-"
  normalized = normalized.replace(
    /\b(sq|ach|type|id|co|trace|date|ecc|ppd|trace|bank|credit|debit|card|payment|purchase|withdrawal|deposit|transfer|online|pos|atm|fee|auth|pending|check|mobile|transaction|reference|ref|desc|info|details|statement|posted|posted date|amount|balance|available|posted|settled|settlement|cleared|clearing|posted|memo|note|description|desc|payee|payer|account|acct|number|no|num|statement|period|cycle|ending|beginning|open|close|closing|opening|cycle|period|statement|summary|activity|history)\b/gi,
    " "
  );

  // Remove US state abbreviations (but NOT "IN-" or "INNOUT")
  // Only match state abbreviations as whole words not followed by "-" or a letter
  normalized = normalized.replace(
    /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/gi,
    " "
  );

  // Remove phone numbers, dates, long digit sequences
  normalized = normalized
    .replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, " ")
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, " ")
    .replace(/\d{10,}/g, " ");

  // Remove extra spaces and non-alphanumeric except some punctuation
  normalized = normalized
    .replace(/\s{2,}/g, " ")
    .replace(/[^a-zA-Z0-9 &',.-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  // Restore protected brand
  normalized = normalized.replace(/INNOUT/gi, "IN-N-OUT");

  return normalized;
}

// --- Extraction Module ---
function extractMerchantAndMCC(description) {
  // Match MCC, MC, or M (with or without space) followed by 3 or 4 digits
  const mccMatch = description.match(/\bM(?:CC?)?\s*(\d{3,4})\b/i);
  const mcc = mccMatch ? mccMatch[1] : null;

  // 1. Prefer CO: rule
  let merchantCandidate = null;
  const coMatch = description.match(
    /\bCO:\s*([^%\n]+?)(?=\s{2,}|%%|ACH|Trace|ID:|PPD|WEB|POS|ATM|DBT|CRD|TRN|MCC|$)/i
  );
  if (coMatch) {
    merchantCandidate = coMatch[1].trim();
  }

  // 2. If not CO:, try to extract main domain (e.g. hbomax from help.hbomax.com)
  if (!merchantCandidate) {
    // Find something like 'SOMETHING.COM' or 'SOMETHING.SOMETHING.COM'
    const domainMatch = description.match(
      /([a-zA-Z0-9-]+\.)*([a-zA-Z0-9-]+)\.(com|net|org|io|ai|co|gov|edu|us|ca|uk|de|fr|jp|au|info|biz|tv|me|ly|app|dev|shop|store|cloud|xyz|site|online)/i
    );
    if (domainMatch) {
      merchantCandidate = domainMatch[2];
    }
  }

  // 3. Otherwise, fallback to previous logic
  if (!merchantCandidate) {
    let merchantPart = description
      .replace(/\bM(?:CC?)?\s*\d{3,4}\b/gi, " ")
      .replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, " ")
      .replace(/\d{2}\/\d{2}\/\d{2,4}/g, " ")
      .replace(/\d{10,}/g, " ")
      .replace(/[#*%]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const merchantMatch = merchantPart.match(
      /^([A-Za-z0-9 &',.-]+?)(?=\s+\d|\s+Date|\s+%%|\s+ACH|\s+Trace|\s+ID|\s+CO|\s+PPD|\s+WEB|\s+POS|\s+ATM|\s+DBT|\s+CRD|\s+TRN|\s+\bMCC?\b|$)/i
    );
    merchantCandidate = merchantMatch ? merchantMatch[1] : merchantPart;
  }

  // 4. Remove city/state names from merchantCandidate
  const usStates = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ];
  // Remove state abbreviations at end or after merchant
  merchantCandidate = merchantCandidate.replace(
    new RegExp(`\\b(${usStates.join("|")})\\b`, "gi"),
    " "
  );
  // Remove common city names (add more as needed)
  const cities = [
    "PHOENIX",
    "SCOTTSDALE",
    "LAS VEGAS",
    "BENTONVILLE",
    "PRESCOTT",
    "AUSTIN",
    "NEW YORK",
    "LOS ANGELES",
    "CHICAGO",
    "DALLAS",
    "HOUSTON",
    "SAN FRANCISCO",
    "SEATTLE",
    "BOSTON",
    "MIAMI",
    "ORLANDO",
    "ATLANTA",
    "DENVER",
    "PORTLAND",
    "MINNEAPOLIS",
    "DETROIT",
    "COLUMBUS",
    "NASHVILLE",
    "CHARLOTTE",
    "INDIANAPOLIS",
    "SAN DIEGO",
    "SAN JOSE",
    "JACKSONVILLE",
    "FORT WORTH",
    "EL PASO",
    "MEMPHIS",
    "OKLAHOMA CITY",
    "LOUISVILLE",
    "BALTIMORE",
    "MILWAUKEE",
    "ALBUQUERQUE",
    "TUCSON",
    "FRESNO",
    "SACRAMENTO",
    "MESA",
    "KANSAS CITY",
    "OMAHA",
    "CLEVELAND",
    "VIRGINIA BEACH",
    "RALEIGH",
    "COLORADO SPRINGS",
    "LONG BEACH",
    "MIAMI",
    "OAKLAND",
    "TULSA",
    "MINNEAPOLIS",
    "ARLINGTON",
    "TAMPA",
    "NEW ORLEANS",
    "WICHITA",
    "BAKERSFIELD",
    "AURORA",
    "ANAHEIM",
    "HONOLULU",
    "SANTA ANA",
    "RIVERSIDE",
    "CORPUS CHRISTI",
    "LEXINGTON",
    "HENDERSON",
    "STOCKTON",
    "SAINT PAUL",
    "CINCINNATI",
    "ST. LOUIS",
    "PITTSBURGH",
    "GREENSBORO",
    "ANCHORAGE",
    "PLANO",
    "LINCOLN",
    "BUFFALO",
    "JERSEY CITY",
    "CHULA VISTA",
    "FORT WAYNE",
    "ORLANDO",
    "ST. PETERSBURG",
    "CHANDLER",
    "LAREDO",
    "MADISON",
    "DURHAM",
    "LUBBOCK",
    "WINSTON–SALEM",
    "GARLAND",
    "GLENDALE",
    "RENO",
    "HIALEAH",
    "BATON ROUGE",
    "IRVING",
    "CHESAPEAKE",
    "SCOTTSDALE",
    "NORTH LAS VEGAS",
    "FREMONT",
    "GILBERT",
    "SAN BERNARDINO",
    "BOISE",
    "BIRMINGHAM",
  ];
  merchantCandidate = merchantCandidate.replace(
    new RegExp(`\\b(${cities.join("|")})\\b`, "gi"),
    " "
  );
  merchantCandidate = merchantCandidate.replace(/\s{2,}/g, " ").trim();

  const merchant = normalizeMerchantName(merchantCandidate);
  return { merchant, mcc };
}

// --- Matching Module ---
function matchMerchant({ description, merchant, mcc }) {
  // No card brand or payment network matching. Only match on actual merchant names.

  // 2. Word-boundary exact match (prioritized, skip generic card brands)
  const cardBrands = ["Mastercard", "Visa"]; // Add more if needed
  const wordBoundaryMerchant = merchants.find((m) => {
    const normName = normalizeMerchantName(m.name);
    if (cardBrands.includes(normName)) return false;
    const pattern = new RegExp(
      `\\b${normName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    return pattern.test(merchant);
  });
  if (wordBoundaryMerchant) {
    const category = categories.find(
      (cat) => cat.id === wordBoundaryMerchant.default_category_id
    );
    return {
      merchant_id: wordBoundaryMerchant.id ?? null,
      clean_description: wordBoundaryMerchant.name ?? null,
      category_id: category ? category.id : null,
      category_name: category ? category.name : null,
      confidence: 98,
      needs_review: false,
      match_type: "word_boundary_exact",
    };
  }

  // 3. Fuzzy match (word boundary prioritized)
  const fuse = new Fuse(
    merchants.map((m) => ({
      ...m,
      _normalized: normalizeMerchantName(m.name),
    })),
    { keys: ["_normalized"], threshold: 0.3 }
  );
  const merchantResults = merchant ? fuse.search(merchant) : [];
  if (merchantResults.length > 0) {
    const matchedMerchant = merchantResults[0].item;
    const score = merchantResults[0].score;
    // Refined confidence scoring: penalize for longer edit distance, boost for short matches
    let confidence = 100;
    if (score !== undefined) {
      confidence = Math.round((1 - score) * 100);
      if (
        confidence < 100 &&
        merchant &&
        matchedMerchant.name &&
        merchant.length > 0
      ) {
        // Penalize if merchant name is much shorter or longer than matched
        const lenRatio =
          Math.min(merchant.length, matchedMerchant.name.length) /
          Math.max(merchant.length, matchedMerchant.name.length);
        if (lenRatio < 0.7) confidence = Math.max(confidence - 10, 0);
      }
    }
    const category = categories.find(
      (cat) => cat.id === matchedMerchant.default_category_id
    );
    if (confidence >= 85) {
      return {
        merchant_id: matchedMerchant.id ?? null,
        clean_description: matchedMerchant.name ?? null,
        category_id: category ? category.id : null,
        category_name: category ? category.name : null,
        confidence,
        needs_review: confidence < 90,
        match_type: "fuzzy",
      };
    }
    // Moderate confidence: cross-check MCC/category
    if (confidence >= 65 && confidence < 85 && mcc) {
      const mccRow = mccCategoryMap.find(
        (row) => String(row.mcc) === String(mcc)
      );
      if (mccRow && category && mccRow.category_id === category.id) {
        return {
          merchant_id: matchedMerchant.id ?? null,
          clean_description: matchedMerchant.name ?? null,
          category_id: category.id,
          category_name: category.name,
          confidence,
          needs_review: true,
          match_type: "fuzzy_mcc_cross",
        };
      }
    }
  }

  // 4. Substring match (word boundary, fallback)
  const substringMerchant = merchants.find((m) => {
    const pattern = new RegExp(
      `\\b${m.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    return pattern.test(description);
  });
  if (substringMerchant) {
    const category = categories.find(
      (cat) => cat.id === substringMerchant.default_category_id
    );
    return {
      merchant_id: substringMerchant.id ?? null,
      clean_description: substringMerchant.name ?? null,
      category_id: category ? category.id : null,
      category_name: category ? category.name : null,
      confidence: 90,
      needs_review: false,
      match_type: "substring",
    };
  }

  // --- NEW: Word or partial word match fallback ---
  // Add a list of stopwords for partial matching
  const partialStopwords = [
    "best",
    "market",
    "store",
    "shop",
    "mart",
    "food",
    "gas",
    "auto",
    "valley",
    "of",
    "the",
    "and",
    "for",
    "in",
    "on",
    "at",
    "by",
    "to",
    "from",
    "with",
    "st",
    "ln",
    "ave",
    "pl",
    "ct",
    "dr",
    "blvd",
    "rd",
    "way",
    "ter",
    "pkwy",
    "cir",
  ];

  if (merchant) {
    const words = merchant
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9-]/g, ""))
      .filter(
        (w) => w.length > 3 && !partialStopwords.includes(w.toLowerCase())
      );
    for (const word of words) {
      for (const m of merchants) {
        const normName = normalizeMerchantName(m.name);
        if (normName.toLowerCase().includes(word.toLowerCase())) {
          // Only match if at least two significant words overlap
          const normWords = normName
            .split(/\s+/)
            .filter(
              (w) => w.length > 3 && !partialStopwords.includes(w.toLowerCase())
            );
          const overlap = normWords.filter((nw) => words.includes(nw));
          if (overlap.length >= 2) {
            const category = categories.find(
              (cat) => cat.id === m.default_category_id
            );
            return {
              merchant_id: m.id ?? null,
              clean_description: m.name ?? null,
              category_id: category ? category.id : null,
              category_name: category ? category.name : null,
              confidence: 80,
              needs_review: true,
              match_type: "partial_word_overlap",
            };
          }
        }
      }
    }
  }

  return null; // No merchant match
}

// --- MCC and Fallback Module ---
function matchMCC({ description, merchant, mcc }) {
  // 1. Direct MCC match
  if (mcc) {
    const mccRow = mccCategoryMap.find(
      (row) => String(row.mcc) === String(mcc)
    );
    if (mccRow) {
      const category = categories.find((cat) => cat.id === mccRow.category_id);
      return {
        merchant_id: null,
        clean_description: merchant ?? null,
        category_id: category ? category.id : null,
        category_name: category ? category.name : null,
        confidence: 90,
        needs_review: false,
        match_type: "mcc",
      };
    }
  }

  // 2. Last-ditch: 4-digit code not part of address
  const streetTypes = "(St|Ave|Ln|Dr|Blvd|Rd|Way|Pl|Ct|Ter|Pkwy|Cir)";
  const addressPattern = new RegExp(
    `\\b\\d{4}\\b\\s*(N|E|S|W)?\\s*${streetTypes}\\b`,
    "i"
  );
  const fourDigitMatches = [...description.matchAll(/\b(\d{4})\b/g)];

  for (let i = fourDigitMatches.length - 1; i >= 0; i--) {
    const match = fourDigitMatches[i];
    const code = match[1];
    const idx = match.index ?? 0;
    const window = description.slice(idx, idx + 20);
    if (addressPattern.test(window)) continue;
    const mccRow = mccCategoryMap.find((row) => String(row.mcc) === code);
    if (mccRow) {
      const category = categories.find((cat) => cat.id === mccRow.category_id);
      return {
        merchant_id: null,
        clean_description: merchant ?? null,
        category_id: category ? category.id : null,
        category_name: category ? category.name : null,
        confidence: 70,
        needs_review: true,
        match_type: "mcc_fallback",
      };
    }
  }

  return null; // No MCC match
}

// --- Load data from Supabase ---
async function loadReferenceData() {
  const [merchantsRes, categoriesRes, mccRes] = await Promise.all([
    supabase.from("merchants").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("mcc_category_map").select("*"),
  ]);
  if (merchantsRes.data) merchants = merchantsRes.data;
  if (categoriesRes.data) categories = categoriesRes.data;
  if (mccRes.data) mccCategoryMap = mccRes.data;
}

// --- Main categorization function ---
async function categorizeTransaction(description) {
  if (!merchants.length || !categories.length || !mccCategoryMap.length) {
    await loadReferenceData();
  }

  const { merchant, mcc } = extractMerchantAndMCC(description);
  let match = matchMerchant({ description, merchant, mcc });
  if (match) {
    // Ensure all fields are present
    return {
      merchant_id: match.merchant_id ?? null,
      clean_description: match.clean_description ?? null,
      category_id: match.category_id ?? null,
      category_name: match.category_name ?? null,
      confidence: match.confidence ?? 0,
      needs_review: match.needs_review ?? true,
      match_type: match.match_type ?? "none",
    };
  }

  match = matchMCC({ description, merchant, mcc });
  if (match) {
    return {
      merchant_id: match.merchant_id ?? null,
      clean_description: match.clean_description ?? null,
      category_id: match.category_id ?? null,
      category_name: match.category_name ?? null,
      confidence: match.confidence ?? 0,
      needs_review: match.needs_review ?? true,
      match_type: match.match_type ?? "none",
    };
  }

  // Fallback: just return cleaned merchant name, all fields present
  return {
    merchant_id: null,
    clean_description: merchant || normalizeMerchantName(description) || null,
    category_id: null,
    category_name: null,
    confidence: 0,
    needs_review: true,
    match_type: "none",
  };
}

// --- Example usage ---
(async () => {
  const description =
    "TYPE: Payroll  ID: 1730383055 CO: MIDFIRST BANK %% ACH ECC PPD %% ACH Trace 303087998331133";
  const result = await categorizeTransaction(description);
  console.log(result);
})();

export {
  categorizeTransaction,
  loadReferenceData,
  extractMerchantAndMCC,
  normalizeMerchantName,
};
