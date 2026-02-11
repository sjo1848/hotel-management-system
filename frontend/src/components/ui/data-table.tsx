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

export interface Column<T> {
    header: string;
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
    actions?: React.ReactNode;
    emptyMessage?: string;
}

export function DataTable<T extends { id: string | number }>({
    columns,
    data,
    isLoading,
    searchable,
    searchPlaceholder = "Buscar...",
    onSearch,
    actions,
    emptyMessage = "No se encontraron resultados.",
}: DataTableProps<T>) {
    return (
        <div className="space-y-4">
            {/* Toolbar */}
            {(searchable || actions) && (
                <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    {searchable && (
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder={searchPlaceholder}
                                className="pl-9 h-10 border-slate-200 focus:border-secondary focus:ring-secondary/20 rounded-lg bg-slate-50/50"
                                onChange={(e) => onSearch && onSearch(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        {actions}
                    </div>
                </div>
            )}

            {/* Table Container */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden text-slate-700">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow className="hover:bg-slate-50">
                            {columns.map((col, idx) => (
                                <TableHead
                                    key={idx}
                                    className={`text-slate-600 font-semibold h-12 uppercase text-xs tracking-wider ${col.className || ""}`}
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
                                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                                        <span className="text-sm font-medium">Cargando datos...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                        <div className="bg-slate-50 p-4 rounded-full">
                                            <Inbox className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <span className="text-sm font-medium">{emptyMessage}</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item, rowIdx) => (
                                <TableRow
                                    key={item.id}
                                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group"
                                >
                                    {columns.map((col, colIdx) => (
                                        <TableCell key={colIdx} className={`py-4 ${col.className || ""}`}>
                                            {col.cell
                                                ? col.cell(item)
                                                : col.accessorKey
                                                    ? (item[col.accessorKey] as React.ReactNode)
                                                    : null
                                            }
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer / Pagination (Placeholder) */}
            {!isLoading && data.length > 0 && (
                <div className="flex items-center justify-between px-2 text-xs text-slate-500">
                    <div>Mostrando {data.length} resultados</div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled className="h-8 text-xs">Anterior</Button>
                        <Button variant="outline" size="sm" disabled className="h-8 text-xs">Siguiente</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
