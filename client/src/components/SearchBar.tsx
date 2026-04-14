import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onFilterToggle?: () => void;
  onLayoutSettingsToggle?: () => void;
  placeholder?: string;
  activeFilters?: string[];
  onRemoveFilter?: (filter: string) => void;
}

export default function SearchBar({
  onSearch,
  onFilterToggle,
  onLayoutSettingsToggle,
  placeholder = "Search games...",
  activeFilters = [],
  onRemoveFilter,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  // Trigger search on input change for live search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    onSearch?.("");
  };

  const handleFilterClick = () => {
    onFilterToggle?.();
  };

  const handleRemoveFilter = (filter: string) => {
    onRemoveFilter?.(filter);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 pr-10 backdrop-blur-sm"
            data-testid="input-search"
            aria-label="Search games"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-transparent"
              onClick={handleClearSearch}
              aria-label="Clear search"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button
          type="submit"
          variant="default"
          className="h-11 rounded-xl px-4"
          data-testid="button-search"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleFilterClick}
          className="h-11 rounded-xl px-4"
          data-testid="button-filter"
          aria-label="Toggle filters"
        >
          <Filter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onLayoutSettingsToggle}
          className="h-11 rounded-xl px-4"
          data-testid="button-layout-settings"
          aria-label="Toggle layout settings"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
      </form>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter}
              variant="secondary"
              className="gap-1"
              data-testid={`filter-${filter.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {filter}
              <Button
                variant="ghost"
                size="icon"
                className="w-3 h-3 p-0 hover:bg-transparent"
                onClick={() => handleRemoveFilter(filter)}
                aria-label={`Remove filter: ${filter}`}
                data-testid={`button-remove-filter-${filter.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
