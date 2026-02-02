import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter } from "@/lib/icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BehaviorAnalyticsFiltersProps {
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  onPageFilterChange: (page: string) => void;
  availablePages?: string[];
}

export function BehaviorAnalyticsFilters({
  onDateRangeChange,
  onPageFilterChange,
  availablePages = [],
}: BehaviorAnalyticsFiltersProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>("all");

  const handleStartDateSelect = (date: Date | undefined) => {
    const newDate = date || null;
    setStartDate(newDate);
    onDateRangeChange(newDate, endDate);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    const newDate = date || null;
    setEndDate(newDate);
    onDateRangeChange(startDate, newDate);
  };

  const handlePageChange = (page: string) => {
    setSelectedPage(page);
    onPageFilterChange(page);
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedPage("all");
    onDateRangeChange(null, null);
    onPageFilterChange("all");
  };

  const hasActiveFilters = startDate || endDate || selectedPage !== "all";

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          {/* Filtro de Data Inicial */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? (
                  format(startDate, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Data inicial</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate || undefined}
                onSelect={handleStartDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Filtro de Data Final */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? (
                  format(endDate, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Data final</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate || undefined}
                onSelect={handleEndDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Filtro de Página */}
          {availablePages.length > 0 && (
            <select
              value={selectedPage}
              onChange={(e) => handlePageChange(e.target.value)}
              className="h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todas as páginas</option>
              {availablePages.map((page) => (
                <option key={page} value={page}>
                  {page === "/" ? "Homepage" : page}
                </option>
              ))}
            </select>
          )}

          {/* Botão Limpar Filtros */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

