"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterConfig {
  label: string;
  type: "text" | "number" | "select" | "date" | "dateRange" | "amount";
  field: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface AdvancedFilterProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onReset: () => void;
}

export function AdvancedFilters({
  filters,
  values,
  onChange,
  onReset,
}: AdvancedFilterProps) {
  const [open, setOpen] = React.useState(false);

  const activeFiltersCount = Object.values(values).filter(
    (v) => v !== undefined && v !== "" && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const handleChange = (field: string, value: any) => {
    onChange({ ...values, [field]: value });
  };

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Filter className="h-4 w-4" />
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtry zaawansowane</SheetTitle>
          <SheetDescription>
            Dostosuj kryteria wyszukiwania
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {filters.map((filter) => (
            <div key={filter.field} className="space-y-2">
              <Label>{filter.label}</Label>
              {filter.type === "text" && (
                <Input
                  value={values[filter.field] || ""}
                  onChange={(e) => handleChange(filter.field, e.target.value)}
                  placeholder={filter.placeholder}
                />
              )}
              {filter.type === "number" && (
                <Input
                  type="number"
                  value={values[filter.field] || ""}
                  onChange={(e) => handleChange(filter.field, e.target.value)}
                  placeholder={filter.placeholder}
                />
              )}
              {filter.type === "amount" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={values[`${filter.field}Min`] || ""}
                    onChange={(e) => handleChange(`${filter.field}Min`, e.target.value)}
                    placeholder="Od"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={values[`${filter.field}Max`] || ""}
                    onChange={(e) => handleChange(`${filter.field}Max`, e.target.value)}
                    placeholder="Do"
                  />
                </div>
              )}
              {filter.type === "select" && filter.options && (
                <Select
                  value={values[filter.field] || ""}
                  onValueChange={(value) => handleChange(filter.field, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filter.placeholder || "Wybierz..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((opt) => {
                      const itemValue = opt.value === "" ? "__all__" : opt.value;
                      return (
                        <SelectItem key={itemValue || opt.label} value={itemValue}>
                          {opt.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {filter.type === "date" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !values[filter.field] && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {values[filter.field] ? (
                        format(new Date(values[filter.field]), "PPP", { locale: pl })
                      ) : (
                        <span>{filter.placeholder || "Wybierz datę"}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={values[filter.field] ? new Date(values[filter.field]) : undefined}
                      onSelect={(date) => handleChange(filter.field, date?.toISOString())}
                      locale={pl}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
              {filter.type === "dateRange" && (
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !values[`${filter.field}From`] && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {values[`${filter.field}From`] ? (
                          format(new Date(values[`${filter.field}From`]), "PPP", { locale: pl })
                        ) : (
                          <span>Od</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          values[`${filter.field}From`]
                            ? new Date(values[`${filter.field}From`])
                            : undefined
                        }
                        onSelect={(date) =>
                          handleChange(`${filter.field}From`, date?.toISOString())
                        }
                        locale={pl}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !values[`${filter.field}To`] && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {values[`${filter.field}To`] ? (
                          format(new Date(values[`${filter.field}To`]), "PPP", { locale: pl })
                        ) : (
                          <span>Do</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          values[`${filter.field}To`]
                            ? new Date(values[`${filter.field}To`])
                            : undefined
                        }
                        onSelect={(date) =>
                          handleChange(`${filter.field}To`, date?.toISOString())
                        }
                        locale={pl}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline" className="flex-1">
            <X className="h-4 w-4 mr-2" />
            Wyczyść
          </Button>
          <Button onClick={() => setOpen(false)} className="flex-1">
            Zastosuj
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
