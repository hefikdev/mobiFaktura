"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchableText?: string; // Additional text to search through (e.g., UUID, NIP, email)
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  emptyText = "No options found.",
  searchPlaceholder = "Szukaj",
  className,
  disabled = false,
  required = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Find the currently selected option
  const selectedOption = options.find((option) => option.value === value);

  // Filter options based on search query.
  // Safety: allow searching by `value` (usually UUID) even if caller forgot to provide `searchableText`.
  // We DO NOT overwrite `option.searchableText` (so the UI won't suddenly show raw UUIDs) —
  // instead compute a `searchIndex` used only for filtering.
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;

    const query = searchQuery.toLowerCase();
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(query);

      // prefer explicit searchableText, otherwise fall back to the value (id)
      const searchIndex = (option.searchableText ?? String(option.value) ?? "").toLowerCase();
      const searchableTextMatch = searchIndex.includes(query);

      return labelMatch || searchableTextMatch;
    });
  }, [options, searchQuery]);

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex flex-col">
          {/* Search Input (use shared SearchInput) */}
          <div className="p-2 border-b">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
              className="w-full"
              showIcon
            />
          </div>

          {/* Options List */}
          <ScrollArea className="max-h-[300px]">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start font-normal",
                      value === option.value && "bg-accent"
                    )}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate w-full">{option.label}</span>
                      {option.searchableText && (
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {option.searchableText}
                        </span>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
