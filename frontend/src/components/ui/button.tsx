*** Begin Patch
*** Update File: frontend/src/components/ui/button.tsx
@@
-      size: {
-        default: "h-9 px-4 py-2",
-        sm: "h-8 rounded-md px-3 text-xs",
-        lg: "h-10 rounded-md px-8",
-        icon: "h-9 w-9",
-      },
+      size: {
+        // Default size bumped to h-11 (44px) for better touch targets on mobile
+        default: "h-11 px-4 py-2",
+        sm: "h-8 rounded-md px-3 text-xs",
+        lg: "h-10 rounded-md px-8",
+        icon: "h-9 w-9",
+      },
*** End Patch