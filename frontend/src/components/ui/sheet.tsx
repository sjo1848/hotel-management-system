*** Begin Patch
*** Update File: frontend/src/components/ui/sheet.tsx
@@
-  <SheetPortal>
-    <SheetOverlay />
-    <SheetPrimitive.Content
-      ref={ref}
-      className={cn(sheetVariants({ side }), className)}
-      {...props}
-    >
+  <SheetPortal>
+    <SheetOverlay />
+    <SheetPrimitive.Content
+      ref={ref}
+      // Add bottom padding on small screens so a fixed footer won't overlap content
+      className={cn(sheetVariants({ side }), "pb-20 sm:pb-0", className)}
+      {...props}
+    >
@@
-const SheetFooter = ({
-  className,
-  ...props
-}: React.HTMLAttributes<HTMLDivElement>) => (
-  <div
-    className={cn(
-      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
-      className
-    )}
-    {...props}
-  />
-)
+const SheetFooter = ({
+  className,
+  ...props
+}: React.HTMLAttributes<HTMLDivElement>) => (
+  <div
+    className={cn(
+      // Mobile: sticky footer inside the sheet to keep CTA visible.
+      // Desktop/tablet (sm+): static footer aligned to the right as before.
+      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
+      // Sticky on xs, static on sm+
+      "fixed bottom-0 left-0 right-0 sm:static sm:bottom-auto sm:left-auto sm:right-auto",
+      // Visual surface and safe-area handling
+      "bg-background/95 border-t border-border p-4 sm:p-0 safe-bottom",
+      className
+    )}
+    {...props}
+  />
+)
*** End Patch