// src/hooks/useMerchants.ts
'use client';

import { useState, useEffect } from 'react';

export interface Merchant {
  id: string;
  name: string;
  logo_url: string | null;
  transaction_count: number;
  categories?:
    | {
        id: string;
        name: string;
        icon: string;
      }[]
    | null;
}

export function useMerchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/merchants/all', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch merchants: ${response.status}`);
        }

        const data = await response.json();
        setMerchants(data.data || []);
      } catch (err) {
        console.error('Error fetching merchants:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch merchants');
        // Fallback to some default merchants
        setMerchants([
          {
            id: 'amazon',
            name: 'Amazon',
            logo_url: null,
            transaction_count: 45,
          },
          {
            id: 'walmart',
            name: 'Walmart',
            logo_url: null,
            transaction_count: 23,
          },
          {
            id: 'target',
            name: 'Target',
            logo_url: null,
            transaction_count: 18,
          },
          {
            id: 'costco',
            name: 'Costco',
            logo_url: null,
            transaction_count: 12,
          },
          {
            id: 'starbucks',
            name: 'Starbucks',
            logo_url: null,
            transaction_count: 34,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    void fetchMerchants();
  }, []);

  return { merchants, loading, error };
}
