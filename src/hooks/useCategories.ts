// src/hooks/useCategories.ts
'use client';

import { useState, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  count?: number;
}

export function useCategories(userId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = userId
          ? `/api/categories/with-icons?user_id=${encodeURIComponent(userId)}`
          : '/api/categories/with-icons';

        const response = await fetch(url, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        const data = await response.json();
        const categoryData = data.data || [];

        // Transform to Category objects with proper color assignment
        const categoryObjects: Category[] = categoryData.map(
          (
            cat: {
              id: string;
              name: string;
              icon?: string;
              transaction_count?: number;
            },
            index: number,
          ) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || 'HelpCircle', // Default to HelpCircle Lucide icon
            color: getDefaultColor(index),
            count: cat.transaction_count || 0,
          }),
        );

        setCategories(categoryObjects);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        // Fallback to some default categories
        setCategories([
          {
            id: 'food',
            name: 'Food',
            icon: 'Utensils',
            color: 'bg-orange-500',
          },
          {
            id: 'transport',
            name: 'Transport',
            icon: 'Car',
            color: 'bg-blue-500',
          },
          {
            id: 'shopping',
            name: 'Shopping',
            icon: 'ShoppingCart',
            color: 'bg-purple-500',
          },
          {
            id: 'entertainment',
            name: 'Entertainment',
            icon: 'Ticket',
            color: 'bg-pink-500',
          },
          { id: 'bills', name: 'Bills', icon: 'Receipt', color: 'bg-red-500' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    void fetchCategories();
  }, [userId]);

  return { categories, loading, error };
}

// Helper function to get default colors for categories
function getDefaultColor(index: number): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];
  return colors[index % colors.length];
}
