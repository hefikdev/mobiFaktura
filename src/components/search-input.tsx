"use client";

import { memo, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = "Szukaj",
  className = "w-full",
  showIcon = false,
}: SearchInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  // Ensure the outer container is a flexible, shrinkable element so the input
  // can take up available space when placed inside flex rows.
  // Apply incoming layout classes to the wrapper (callers often pass `flex-1`).
  const wrapperClass = `relative w-full min-w-0 ${className}`.trim();

  // Input should always be full-width; icon adds left padding.
  const inputClassName = useMemo(() => 
    showIcon ? `w-full min-w-0 pl-10` : `w-full min-w-0`,
    [showIcon]
  );
  
  return (
    <div className={wrapperClass}>
      {showIcon && (
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={inputClassName}
      />
    </div>
  );
});