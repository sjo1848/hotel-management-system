*** Begin Patch
*** Update File: frontend/src/features/schedule/CalendarTimeline.tsx
@@
-    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
-      <table className="min-w-[860px] w-full border-collapse" aria-label="Timeline de ocupación">
+    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
+      {/* Make timeline responsive: full width on small screens, preserve wide timeline on md+ */}
+      <table className="w-full md:min-w-[860px] border-collapse" aria-label="Timeline de ocupación">
@@
-            <th scope="col" className="sticky left-0 z-20 min-w-[210px] border-b border-r border-border bg-card px-4 py-3 text-left text-xs font-bold text-muted-foreground">Habitación</th>
-            {dates.map((date) => (
-              <th scope="col" key={date} className="min-w-[74px] border-b border-r border-border bg-card px-2 py-3 text-center text-xs font-bold text-muted-foreground">
+            <th scope="col" className="sticky left-0 z-20 min-w-[160px] md:min-w-[210px] border-b border-r border-border bg-card px-4 py-3 text-left text-xs font-bold text-muted-foreground">Habitación</th>
+            {dates.map((date) => (
+              <th scope="col" key={date} className="min-w-[64px] md:min-w-[74px] border-b border-r border-border bg-card px-2 py-3 text-center text-xs font-bold text-muted-foreground">
@@
-                <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-3 text-left">
+                <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 md:px-4 py-3 text-left">
@@
-                {dates.map((date) => {
+                {dates.map((date) => {
@@
-                    return (
-                      <td key={date} className="h-20 border-b border-r border-border p-1 align-middle">
+                    return (
+                      <td key={date} className="h-20 border-b border-r border-border p-1 align-middle">
*** End Patch