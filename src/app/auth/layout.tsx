/**
 * Auth layout — full-screen overlay that sits above the main app shell
 * (Sidebar + Header) so auth pages render without any navigation chrome.
 *
 * This is the simplest non-destructive approach while the project
 * still uses a single root layout. For production you could refactor
 * to route groups: (app)/layout.tsx and (auth)/layout.tsx.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
      {children}
    </div>
  );
}
