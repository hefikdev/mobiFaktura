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
  className = "max-w-sm",
  showIcon = false,
}: SearchInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  const inputClassName = useMemo(() => 
    showIcon ? `${className} pl-10` : className,
    [showIcon, className]
  );
  
  return (
    <div className="relative">
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