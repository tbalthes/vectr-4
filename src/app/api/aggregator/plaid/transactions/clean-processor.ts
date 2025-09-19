import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/status_logging/logger';

// Merchant interface for database operations
interface Merchant {
  merchant_id: string;
  name: string;
  regex_match: string | null;
  default_category_id: string | null;
  logo_url: string | null;
  website_url?: string | null;
  plaid_entity_id?: string | null;
  is_active?: boolean;
}

// Counterparty interface for better typing
interface Counterparty {
  confidence_level: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  entity_id: string | null;
  logo_url: string | null;
  name: string;
  phone_number: string | null;
  type:
    | 'merchant'
    | 'financial_institution'
    | 'payment_app'
    | 'marketplace'
    | 'government'
    | 'payroll'
    | 'cryptocurrency'
    | 'third_party_processor'
    | 'peer_to_peer'
    | 'gig_economy'
    | 'subscription'
    | 'insurance'
    | 'utility'
    | 'healthcare'
    | 'other';
  website: string | null;
}

// Clean 1:1 mapping for Plaid transaction data to database schema
export interface PlaidTransaction {
  account_id: string;
  account_owner: string | null;
  amount: number;
  authorized_date: string | null;
  authorized_datetime: string | null;
  category: string[] | null;
  category_id: string | null;
  check_number: string | null;
  counterparties: {
    confidence_level: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
    entity_id: string | null;
    logo_url: string | null;
    name: string;
    phone_number: string | null;
    type:
      | 'merchant'
      | 'financial_institution'
      | 'payment_app'
      | 'marketplace'
      | 'government'
      | 'payroll'
      | 'cryptocurrency'
      | 'third_party_processor'
      | 'peer_to_peer'
      | 'gig_economy'
      | 'subscription'
      | 'insurance'
      | 'utility'
      | 'healthcare'
      | 'other';
    website: string | null;
  }[];
  date: string;
  datetime: string | null;
  iso_currency_code: string;
  location: {
    address: string | null;
    city: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    postal_code: string | null;
    region: string | null;
    store_number: string | null;
  };
  merchant_entity_id: string | null;
  merchant_name: string | null;
  name: string;
  payment_channel: string;
  payment_meta: Record<string, unknown>;
  pending: boolean;
  pending_transaction_id: string | null;
  personal_finance_category: {
    confidence_level: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
    detailed: string;
    primary: string;
  } | null;
  personal_finance_category_icon_url: string | null;
  transaction_code: string | null;
  transaction_id: string;
  transaction_type: string;
  unofficial_currency_code: string | null;
}

export interface ProcessedTransaction {
  // Core transaction fields - direct 1:1 mapping
  date: string;
  amount: number;
  original_description: string;
  check_number: string | null;
  pending: boolean;
  primary_category: string | null;
  detailed_category: string | null;
  confidence_level_category: string | null;

  // Counterparty/merchant fields - from counterparties[0] if confidence = VERY_HIGH
  transaction_type: string | null;
  merchant_name: string | null;
  logo_url: string | null;
  confidence_level_merchant: string | null;
  website_url: string | null;
  plaid_entity_id: string | null;

  // Foreign keys for existing tables
  account_id: string;
  merchant_id: string | null;
  category_id: string | null;

  // Plaid metadata
  plaid_transaction_id: string;
  plaid_data: PlaidTransaction; // Store complete Plaid response for audit
}

/**
 * Clean Plaid Transaction Processor
 * Maps Plaid transaction data 1:1 to database schema
 */
export class CleanPlaidTransactionProcessor {
  private supabase: any; // Using any to avoid complex Supabase typing issues

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * Process Plaid transaction with clean 1:1 mapping
   */
  async processTransaction(plaidTransaction: PlaidTransaction): Promise<ProcessedTransaction> {
    console.log(
      '🔄 Processing Plaid transaction with clean mapping:',
      plaidTransaction.transaction_id,
    );

    // 1. Direct field mapping
    const baseTransaction: ProcessedTransaction = {
      date: plaidTransaction.date,
      amount: plaidTransaction.amount,
      original_description: plaidTransaction.name,
      check_number: plaidTransaction.check_number,
      pending: plaidTransaction.pending,
      primary_category: plaidTransaction.personal_finance_category?.primary || null,
      detailed_category: plaidTransaction.personal_finance_category?.detailed || null,
      confidence_level_category:
        plaidTransaction.personal_finance_category?.confidence_level || null,
      account_id: plaidTransaction.account_id,
      plaid_transaction_id: plaidTransaction.transaction_id,
      plaid_data: plaidTransaction,

      // Initialize merchant fields
      transaction_type: null,
      merchant_name: null,
      logo_url: null,
      confidence_level_merchant: null,
      website_url: null,
      plaid_entity_id: null,
      merchant_id: null,
      category_id: null,
    };

    // 2. Process counterparty data
    const counterparty = plaidTransaction.counterparties?.[0];
    if (counterparty) {
      baseTransaction.transaction_type = counterparty.type;
      baseTransaction.confidence_level_merchant = counterparty.confidence_level;
      baseTransaction.website_url = counterparty.website;
      baseTransaction.plaid_entity_id = counterparty.entity_id;

      // Handle merchant matching based on confidence level
      if (counterparty.confidence_level === 'VERY_HIGH') {
        await this.processHighConfidenceMerchant(baseTransaction, counterparty);
      } else if (counterparty.confidence_level === 'LOW') {
        await this.processLowConfidenceMerchant(baseTransaction, counterparty, plaidTransaction);
      } else {
        // MEDIUM/HIGH confidence - use counterparty name directly
        baseTransaction.merchant_name = counterparty.name;
        baseTransaction.logo_url = counterparty.logo_url;
      }
    }

    // 3. Map category
    if (baseTransaction.detailed_category) {
      baseTransaction.category_id = await this.mapCategoryToDatabase(
        baseTransaction.detailed_category,
      );
    }

    return baseTransaction;
  }

  /**
   * Process VERY_HIGH confidence counterparty
   * Attempt merchant regex matching, create merchant if no match
   */
  private async processHighConfidenceMerchant(
    transaction: ProcessedTransaction,
    counterparty: Counterparty,
  ): Promise<void> {
    console.log('🎯 Processing VERY_HIGH confidence merchant:', counterparty.name);

    // Try to find existing merchant by regex match
    const { data: merchants } = await this.supabase
      .from('merchants')
      .select('merchant_id, name, regex_match, default_category_id, logo_url')
      .eq('is_active', true);

    let matchedMerchant: Merchant | null = null;
    if (merchants && Array.isArray(merchants)) {
      for (const merchant of merchants as Merchant[]) {
        if (merchant.regex_match) {
          try {
            // Strip (?i) prefix if present (Perl/PCRE syntax not supported in JS)
            const cleanRegex = merchant.regex_match.replace(/^\(\?i\)/, '');
            if (new RegExp(cleanRegex, 'i').test(counterparty.name)) {
              matchedMerchant = merchant;
              console.log('✅ Found regex match:', merchant.name);
              break;
            }
          } catch {
            console.warn('Invalid regex pattern:', merchant.regex_match);
          }
        }
      }
    }

    if (matchedMerchant) {
      // Use existing merchant
      transaction.merchant_id = matchedMerchant.merchant_id;
      transaction.merchant_name = matchedMerchant.name;
      transaction.logo_url = matchedMerchant.logo_url;

      // Use merchant's default category if no category mapped yet
      if (!transaction.category_id && matchedMerchant.default_category_id) {
        transaction.category_id = matchedMerchant.default_category_id;
      }
    } else {
      // Create new merchant
      const newMerchant = await this.createMerchant(counterparty, transaction.category_id);
      if (newMerchant) {
        transaction.merchant_id = newMerchant.merchant_id;
        transaction.merchant_name = newMerchant.name;
        transaction.logo_url = newMerchant.logo_url;
      }
    }
  }

  /**
   * Process LOW confidence counterparty
   * Concat name + merchant_name as original_description, then parse
   */
  private async processLowConfidenceMerchant(
    transaction: ProcessedTransaction,
    counterparty: Counterparty,
    plaidTransaction: PlaidTransaction,
  ): Promise<void> {
    console.log('⚠️ Processing LOW confidence merchant:', counterparty.name);

    // Concat name + merchant_name as per your requirement
    const combinedDescription = [plaidTransaction.name, plaidTransaction.merchant_name]
      .filter(Boolean)
      .join(' ');

    transaction.original_description = combinedDescription;

    // Parse through existing transaction logic (CSV-style processing)
    // This would use your existing regex matching logic
    const { data: merchants } = await this.supabase
      .from('merchants')
      .select('merchant_id, name, regex_match, default_category_id, logo_url')
      .eq('is_active', true);

    let matchedMerchant: Merchant | null = null;
    if (merchants && Array.isArray(merchants)) {
      for (const merchant of merchants as Merchant[]) {
        if (merchant.regex_match) {
          try {
            // Strip (?i) prefix if present (Perl/PCRE syntax not supported in JS)
            const cleanRegex = merchant.regex_match.replace(/^\(\?i\)/, '');
            if (new RegExp(cleanRegex, 'i').test(combinedDescription)) {
              matchedMerchant = merchant;
              console.log('✅ Found regex match for low confidence:', merchant.name);
              break;
            }
          } catch {
            console.warn('Invalid regex pattern:', merchant.regex_match);
          }
        }
      }
    }

    if (matchedMerchant) {
      transaction.merchant_id = matchedMerchant.merchant_id;
      transaction.merchant_name = matchedMerchant.name;
      transaction.logo_url = matchedMerchant.logo_url;

      if (!transaction.category_id && matchedMerchant.default_category_id) {
        transaction.category_id = matchedMerchant.default_category_id;
      }
    } else {
      // No match - use clean_description and category lookup
      transaction.merchant_name = this.extractCleanDescription(combinedDescription);
    }
  }

  /**
   * Create new merchant from Plaid counterparty data
   */
  private async createMerchant(
    counterparty: Counterparty,
    categoryId: string | null,
  ): Promise<Merchant | null> {
    console.log('🏪 Creating new merchant:', counterparty.name);

    try {
      const merchantData = {
        name: counterparty.name,
        logo_url: counterparty.logo_url,
        default_category_id: categoryId,
        regex_match: this.escapeRegexPattern(counterparty.name),
        website_url: counterparty.website,
        plaid_entity_id: counterparty.entity_id,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const { data: newMerchant, error } = await this.supabase
        .from('merchants')
        .insert(merchantData)
        .select('merchant_id, name, logo_url')
        .single();

      if (error) {
        console.error('❌ Error creating merchant:', error);
        return null;
      }

      console.log('✅ Created new merchant:', (newMerchant as Merchant).name);
      return newMerchant as Merchant;
    } catch (error) {
      console.error('❌ Error in createMerchant:', error);
      return null;
    }
  }

  /**
   * Map Plaid detailed category to database category_id
   */
  private async mapCategoryToDatabase(detailedCategory: string): Promise<string | null> {
    console.log('🏷️ Mapping category:', detailedCategory);

    try {
      const { data: category } = await this.supabase
        .from('categories')
        .select('category_id')
        .eq('category', detailedCategory)
        .is('user_id', null)
        .single();

      if (category) {
        console.log('✅ Found category mapping:', detailedCategory);
        return category.category_id;
      }

      console.log('⚠️ No category mapping found for:', detailedCategory);
      return null;
    } catch (error) {
      console.error('❌ Error mapping category:', error);
      return null;
    }
  }

  /**
   * Extract clean merchant name from description
   */
  private extractCleanDescription(description: string): string {
    // Simple cleaning - remove common noise
    return description
      .replace(/\b(debit|card|purchase|payment|pos|dda)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Escape regex special characters for safe pattern creation
   */
  private escapeRegexPattern(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Save processed transaction to database
   */
  async saveTransaction(transaction: ProcessedTransaction, userId: string): Promise<boolean> {
    console.log('💾 Saving transaction:', transaction.plaid_transaction_id);

    try {
      // Map Plaid account ID to internal account ID
      const { data: accountMapping } = await this.supabase
        .from('accounts')
        .select('id')
        .eq('aggregator_account_id', transaction.account_id)
        .eq('user_id', userId)
        .single();

      if (!accountMapping) {
        console.error('❌ No internal account found for Plaid account:', transaction.account_id);
        return false;
      }

      const rows = {
        user_id: userId,
        account_id: accountMapping.id, // Use internal UUID, not Plaid account ID
        merchant_id: transaction.merchant_id,
        category_id: transaction.category_id,
        date: transaction.date,
        amount: transaction.amount,
        original_description: transaction.original_description,
        check_number: transaction.check_number,
        pending: transaction.pending,
        primary_category: transaction.primary_category,
        detailed_category: transaction.detailed_category,
        confidence_level_category: transaction.confidence_level_category,
        transaction_type: transaction.transaction_type,
        merchant_name: transaction.merchant_name,
        logo_url: transaction.logo_url,
        confidence_level_merchant: transaction.confidence_level_merchant,
        website_url: transaction.website_url,
        plaid_entity_id: transaction.plaid_entity_id,
        aggregator_transaction_id: transaction.plaid_transaction_id,
        user_metadata: {
          plaid_data: transaction.plaid_data,
          processed_at: new Date().toISOString(),
        },
        needs_review: transaction.confidence_level_merchant === 'LOW' || !transaction.merchant_id,
      };

      const { error: upsertErr } = await this.supabase.from('transactions').upsert(rows, {
        onConflict: 'user_id,aggregator_transaction_id',
        ignoreDuplicates: false,
      });

      if (upsertErr) {
        logger.error(
          { 
            event: 'sync.upsert_failed', 
            metadata: { count: 1 },
            error: { 
              message: upsertErr.message,
              stack: upsertErr.stack
            } 
          },
          'Upsert failed',
        );
        return false;
      }

      console.log('✅ Transaction saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in saveTransaction:', error);
      return false;
    }
  }
}
