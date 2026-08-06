import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/async-state";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onRowClick?: (item: T) => void;
  actions?: React.ReactNode;
  emptyMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  searchable,
  searchPlaceholder = "Buscar...",
  onSearch,
  onRowClick,
  actions,
  emptyMessage = "No se encontraron resultados.",
  error,
  onRetry,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("space-y-4", className)}>
      {(searchable || actions) && (
        <div className="motion-refresh flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {searchable && (
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="h-10 rounded-lg border-border bg-muted/40 pl-9 focus:border-secondary focus:ring-secondary/20"
                onChange={(e) => onSearch && onSearch(e.target.value)}
              />
            </div>
          )}
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            {actions}
          </div>
        </div>
      )}

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

      <div className="motion-refresh overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-0 md:min-w-[720px]">
          <TableHeader className="border-b border-border bg-muted/35">
            <TableRow className="hover:bg-muted/35">
              {columns.map((col, idx) => (
                <TableHead
                  key={idx}
                  className={cn(
                    "h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    idx === 0 && "sticky left-0 z-10 bg-muted/35",
                    col.className,
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                    <span className="text-sm font-medium">Cargando datos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="rounded-full bg-muted p-4">
                      <Inbox className="h-8 w-8 opacity-40" />
                    </div>
                    <span className="text-sm font-medium">{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(
                    "motion-surface group border-b border-border transition-colors hover:-translate-y-px hover:bg-muted/30 last:border-0",
                    onRowClick ? "cursor-pointer" : "",
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={cn(
                        "py-4",
                        colIdx === 0 && "sticky left-0 z-10 bg-card",
                        col.className,
                      )}
                    >
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                          ? (item[col.accessorKey] as React.ReactNode)
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      {!isLoading && data.length > 0 && (
        <div className="motion-refresh flex items-center justify-between px-2 text-xs text-muted-foreground">
          <div>Mostrando {data.length} resultados</div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Button variant="outline" size="sm" disabled className="min-h-9 text-xs">
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled className="min-h-9 text-xs">
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
