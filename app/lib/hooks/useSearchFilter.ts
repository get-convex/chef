import { useState, useMemo, useCallback } from 'react';
import type { ChatHistoryItem } from '~/types/ChatHistoryItem';
import { useDebounce } from '@uidotdev/usehooks';

interface UseSearchFilterOptions {
  items: ChatHistoryItem[];
  searchFields?: (keyof ChatHistoryItem)[];
  debounceMs?: number;
}

export function useSearchFilter({
  items = [],
  searchFields = ['description'],
  debounceMs = 300,
}: UseSearchFilterOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const filteredItems = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return items;
    }

    const query = debouncedSearchQuery.toLowerCase();

    return items.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];

        if (typeof value === 'string') {
          return value.toLowerCase().includes(query);
        }

        return false;
      }),
    );
  }, [items, debouncedSearchQuery, searchFields]);

  return {
    searchQuery,
    filteredItems,
    handleSearchChange,
  };
}
