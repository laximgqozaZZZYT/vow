import React from 'react'

export default function DashboardShell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-6 py-6">
          <main className="col-span-12">
            <div className="rounded-md bg-card p-6 shadow-md">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
