import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchSortBarProps {
  searchPlaceholder?: string;
  sortOptions?: { value: string; label: string }[];
  onSearchChange: (query: string) => void;
  onSortChange: (sortBy: string) => void;
  searchValue: string;
  sortValue: string;
  resultCount?: number;
  totalCount?: number;
}

export default function SearchSortBar({
  searchPlaceholder = '🔍 Search here...',
  sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
  ],
  onSearchChange,
  onSortChange,
  searchValue,
  sortValue,
  resultCount,
  totalCount,
}: SearchSortBarProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);

  const currentSort = sortOptions.find(opt => opt.value === sortValue) || sortOptions[0];

  return (
    <div className="mb-6 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full px-4 py-3 pl-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-gray-900 placeholder-gray-500"
        />
        <div className="absolute left-4 top-3.5 text-gray-400">🔍</div>
        {searchValue && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-3.5 text-gray-500 hover:text-gray-700 font-bold text-lg"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sort & Results */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2 font-medium text-gray-700"
          >
            📊 {currentSort.label}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showSortMenu && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-max">
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 hover:bg-blue-50 ${
                    sortValue === option.value ? 'bg-blue-100 font-medium text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result Counter */}
        {resultCount !== undefined && totalCount !== undefined && (
          <span className="text-sm text-gray-600 font-medium">
            {resultCount === 0
              ? `No results`
              : `${resultCount} of ${totalCount} items`}
            {searchValue && ` (filtered by: "${searchValue}")`}
          </span>
        )}
      </div>
    </div>
  );
}
