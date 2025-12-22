"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Szukaj",
  className = "max-w-sm",
  showIcon = false,
}: SearchInputProps) {
  return (
    <div className="relative">
      {showIcon && (
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={showIcon ? `${className} pl-10` : className}
      />
    </div>
  );
}