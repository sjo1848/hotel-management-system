*** Begin Patch
*** Update File: frontend/src/components/ui/data-table.tsx
@@
-      <div className="motion-refresh overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
-        <div className="overflow-x-auto">
-          {/* Allow full width on small screens and keep min-width for md+. */}
-          <Table className="w-full md:min-w-[720px]">
-          <TableHeader className="border-b border-border bg-muted/35">
-            <TableRow className="hover:bg-muted/35">
-              {columns.map((col, idx) => (
-                <TableHead
-                  key={idx}
-                  className={cn(
-                    "h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
-                    col.className,
-                  )}
-                >
-                  {col.header}
-                </TableHead>
-              ))}
-            </TableRow>
-          </TableHeader>
-          <TableBody>
-            {isLoading ? (
-              <TableRow>
-                <TableCell colSpan={columns.length} className="h-48 text-center">
-                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
-                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
-                    <span className="text-sm font-medium">Cargando datos...</span>
-                  </div>
-                </TableCell>
-              </TableRow>
-            ) : data.length === 0 ? (
-              <TableRow>
-                <TableCell colSpan={columns.length} className="h-64 text-center">
-                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
-                    <div className="rounded-full bg-muted p-4">
-                      <Inbox className="h-8 w-8 opacity-40" />
-                    </div>
-                    <span className="text-sm font-medium">{emptyMessage}</span>
-                  </div>
-                </TableCell>
-              </TableRow>
-            ) : (
-              data.map((item) => (
-                <TableRow
-                  key={item.id}
-                  onClick={onRowClick ? () => onRowClick(item) : undefined}
-                  className={cn(
-                    "motion-surface group border-b border-border transition-colors hover:-translate-y-px hover:bg-muted/30 last:border-0",
-                    onRowClick ? "cursor-pointer" : "",
-                  )}
-                >
-                  {columns.map((col, colIdx) => (
-                    <TableCell key={colIdx} className={cn("py-4", col.className)}>
-                      {col.cell
-                        ? col.cell(item)
-                        : col.accessorKey
-                          ? (item[col.accessorKey] as React.ReactNode)
-                          : null}
-                    </TableCell>
-                  ))}
-                </TableRow>
-              ))
-            )}
-          </TableBody>
-          </Table>
-        </div>
-      </div>
+      <div className="motion-refresh overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
+        {/* Mobile: compact card/list view */}
+        <div className="md:hidden">
+          {error ? (
+            <ErrorState message={String(error)} onRetry={onRetry} />
+          ) : isLoading ? (
+            <div className="h-48 flex items-center justify-center">
+              <Loader2 className="h-8 w-8 animate-spin text-secondary" />
+            </div>
+          ) : data.length === 0 ? (
+            <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
+              <div className="rounded-full bg-muted p-4">
+                <Inbox className="h-8 w-8 opacity-40" />
+              </div>
+              <span className="text-sm font-medium">{emptyMessage}</span>
+            </div>
+          ) : (
+            <div className="space-y-3 p-3">
+              {data.map((item) => (
+                <div
+                  key={item.id}
+                  onClick={onRowClick ? () => onRowClick(item) : undefined}
+                  className={cn(
+                    "group rounded-2xl border border-border bg-background p-3 shadow-sm",
+                    onRowClick ? "cursor-pointer" : ""
+                  )}
+                >
+                  <div className="flex items-start justify-between gap-3">
+                    <div className="flex-1">
+                      {columns.map((col, idx) => (
+                        <div key={idx} className={cn("flex items-center justify-between text-sm", col.className)}>
+                          <div className="text-xs text-muted-foreground">{col.header}</div>
+                          <div className="text-sm font-medium text-foreground">
+                            {col.cell ? col.cell(item) : col.accessorKey ? (item[col.accessorKey] as React.ReactNode) : null}
+                          </div>
+                        </div>
+                      ))}
+                    </div>
+                  </div>
+                </div>
+              ))}
+            </div>
+          )}
+        </div>
+
+        {/* Desktop/Tablet: table view */}
+        <div className="hidden md:block overflow-x-auto">
+          <Table className="w-full md:min-w-[720px]">
+          <TableHeader className="border-b border-border bg-muted/35">
+            <TableRow className="hover:bg-muted/35">
+              {columns.map((col, idx) => (
+                <TableHead
+                  key={idx}
+                  className={cn(
+                    "h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
+                    col.className,
+                  )}
+                >
+                  {col.header}
+                </TableHead>
+              ))}
+            </TableRow>
+          </TableHeader>
+          <TableBody>
+            {isLoading ? (
+              <TableRow>
+                <TableCell colSpan={columns.length} className="h-48 text-center">
+                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
+                    <Loader2 className="h-8 w-8 animate-spin text-secondary" />
+                    <span className="text-sm font-medium">Cargando datos...</span>
+                  </div>
+                </TableCell>
+              </TableRow>
+            ) : data.length === 0 ? (
+              <TableRow>
+                <TableCell colSpan={columns.length} className="h-64 text-center">
+                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
+                    <div className="rounded-full bg-muted p-4">
+                      <Inbox className="h-8 w-8 opacity-40" />
+                    </div>
+                    <span className="text-sm font-medium">{emptyMessage}</span>
+                  </div>
+                </TableCell>
+              </TableRow>
+            ) : (
+              data.map((item) => (
+                <TableRow
+                  key={item.id}
+                  onClick={onRowClick ? () => onRowClick(item) : undefined}
+                  className={cn(
+                    "motion-surface group border-b border-border transition-colors hover:-translate-y-px hover:bg-muted/30 last:border-0",
+                    onRowClick ? "cursor-pointer" : "",
+                  )}
+                >
+                  {columns.map((col, colIdx) => (
+                    <TableCell key={colIdx} className={cn("py-4", col.className)}>
+                      {col.cell
+                        ? col.cell(item)
+                        : col.accessorKey
+                          ? (item[col.accessorKey] as React.ReactNode)
+                          : null}
+                    </TableCell>
+                  ))}
+                </TableRow>
+              ))
+            )}
+          </TableBody>
+          </Table>
+        </div>
+      </div>
*** End Patch