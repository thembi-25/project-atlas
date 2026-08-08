/**
 * Sprint 0 foundation page. Deliberately minimal — no dashboards, no CRM
 * screens, no customer-facing functionality. It exists to prove the
 * application builds, deploys, and serves a page, and to identify the
 * application clearly. Real screens begin with the sprint that owns them
 * — see docs/13-roadmap/ROADMAP-DECISION.md.
 */
export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">Project Atlas</h1>
      <p className="text-muted-foreground text-sm">
        Engineering foundation — Sprint 0. See{' '}
        <code className="bg-muted rounded px-1 py-0.5">/api/v1/health</code>.
      </p>
    </main>
  );
}
