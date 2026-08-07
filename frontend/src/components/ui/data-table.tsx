*** Begin Patch
*** Update File: frontend/src/components/ui/data-table.tsx
@@
-          <Table className="min-w-[720px]">
+          {/* Allow full width on small screens and keep min-width for md+. */}
+          <Table className="w-full md:min-w-[720px]">
*** End Patch