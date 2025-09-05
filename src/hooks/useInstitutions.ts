"use client";

import { useState, useEffect } from "react";

export interface Institution {
  id: string;
  provider: string;
  name: string;
  logo_url?: string;
  url?: string;
  primary_color?: string;
  country_codes?: string[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export function useInstitutions() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInstitutions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/institutions');
      if (!response.ok) {
        throw new Error(`Failed to fetch institutions: ${response.statusText}`);
      }
      
      const data = await response.json();
      setInstitutions(data.institutions || []);
    } catch (err) {
      console.error('Error fetching institutions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const createInstitution = async (institutionData: Partial<Institution>) => {
    try {
      const response = await fetch('/api/institutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(institutionData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create institution: ${response.statusText}`);
      }
      
      const newInstitution = await response.json();
      setInstitutions(prev => [...prev, newInstitution]);
      return newInstitution;
    } catch (err) {
      console.error('Error creating institution:', err);
      throw err;
    }
  };

  return {
    institutions,
    isLoading,
    error,
    refetch: fetchInstitutions,
    createInstitution,
  };
}
