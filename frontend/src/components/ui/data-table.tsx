import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Inbox, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/async-state";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/useMediaQuery";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());

  const toggleExpand = (id: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderCell = (col: Column<T>, item: T) =>
    col.cell ? col.cell(item) : col.accessorKey ? (item[col.accessorKey] as React.ReactNode) : null;

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

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

      {isDesktop ? (
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
                          {renderCell(col, item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="motion-refresh space-y-3">
          {isLoading ? (
            <div className="space-y-3" aria-label="Cargando datos">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                <div className="rounded-full bg-muted p-4">
                  <Inbox className="h-8 w-8 opacity-40" />
                </div>
                <span className="text-sm font-medium">{emptyMessage}</span>
              </div>
            </div>
          ) : (
            data.map((item) => {
              const isOpen = expanded.has(item.id);
              const [first, ...rest] = columns;
              const preview = rest.find((col) => col.accessorKey !== "id");
              return (
                <div
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={onRowClick ? undefined : isOpen}
                    className="flex min-h-[64px] w-full items-center justify-between gap-3 p-4 text-left"
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(item);
                      } else {
                        toggleExpand(item.id);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black">{renderCell(first, item)}</div>
                      {preview ? (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {renderCell(preview, item)}
                        </div>
                      ) : null}
                    </div>
                    {!onRowClick ? (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    ) : null}
                  </button>
                  {!onRowClick && isOpen ? (
                    <dl className="space-y-1 border-t border-border p-4">
                      {columns.map((col, idx) => (
                        <div key={idx} className="grid grid-cols-[8rem_1fr] gap-3 py-1 text-sm">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {col.header}
                          </dt>
                          <dd className="text-foreground">{renderCell(col, item)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}

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
