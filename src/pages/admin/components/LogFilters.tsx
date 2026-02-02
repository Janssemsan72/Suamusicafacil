import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from "@/lib/icons";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface LogFiltersProps {
  activeTab: 'checkout' | 'admin';
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  dateRange?: DateRange;
  eventType?: string;
  action?: string;
  transactionId?: string;
  hasError?: string;
}

const checkoutEventTypes = [
  "checkout_started",
  "quiz_created",
  "order_created",
  "checkout_received",
  "payment_success",
  "error"
];

const adminActions = [
  "generate_lyrics",
  "generate_audio",
  "release_song",
  "update_metadata",
  "update_order",
  "update_song"
];

export function LogFilters({ activeTab, onFilterChange }: LogFiltersProps) {
  const [date, setDate] = useState<DateRange | undefined>();
  const [eventType, setEventType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [hasError, setHasError] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const handleApplyFilters = () => {
    onFilterChange({
      dateRange: date,
      eventType: eventType || undefined,
      action: action || undefined,
      transactionId: transactionId || undefined,
      hasError: hasError || undefined,
    });
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setDate(undefined);
    setEventType("");
    setAction("");
    setTransactionId("");
    setHasError("");
    onFilterChange({});
  };

  const hasActiveFilters = date || eventType || action || transactionId || hasError;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs px-1 py-0.5 h-5">
          <Filter className="h-2.5 w-2.5 mr-0.5" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[6px] font-bold text-primary-foreground">
              !
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filtros Avançados</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd/MM/yy")} -{" "}
                          {format(date.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(date.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecionar período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {activeTab === 'checkout' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Evento</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {checkoutEventTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select value={hasError} onValueChange={setHasError}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="true">Com Erro</SelectItem>
                      <SelectItem value="false">Sem Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-2">
                <Label className="text-xs">Ação</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {adminActions.map((act) => (
                      <SelectItem key={act} value={act}>
                        {act}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Transaction ID</Label>
              <Input
                placeholder="Buscar por ID..."
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <Button onClick={handleApplyFilters} className="w-full" size="sm">
            Aplicar Filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
