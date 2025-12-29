"use client";

import { useState } from "react";
import { NewCategoryModal, NewHabitModal } from "./components/modals";

type Category = { id: string; name: string; details?: string; dueDate?: string; createdAt: string; updatedAt: string };
type Habit = { id: string; categoryId: string; name: string; active: boolean; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; allDay?: boolean; notes?: string; createdAt: string; updatedAt: string };

export default function DashboardPage() {
  const now = new Date().toISOString();
  const [categories, setCategories] = useState<Category[]>([
    { id: "c1", name: "仕事", createdAt: now, updatedAt: now },
    { id: "c2", name: "パーソナル", createdAt: now, updatedAt: now },
  ]);
  const [habits, setHabits] = useState<Habit[]>([
    { id: "h1", categoryId: "c1", name: "メール確認", active: true, type: "do", createdAt: now, updatedAt: now },
    { id: "h2", categoryId: "c1", name: "タスクレビュー", active: false, type: "do", createdAt: now, updatedAt: now },
    { id: "h3", categoryId: "c2", name: "早起き", active: true, type: "do", createdAt: now, updatedAt: now },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categories[0]?.id ?? null
  );

  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openNewHabit, setOpenNewHabit] = useState(false);

  function createCategory(payload: { name: string; details?: string; dueDate?: string }) {
    const id = `c${Date.now()}`;
    const now = new Date().toISOString();
    setCategories((s) => [
      ...s,
      { id, name: payload.name, details: payload.details, dueDate: payload.dueDate, createdAt: now, updatedAt: now },
    ]);
    setSelectedCategory(id);
  }

  function createHabit(payload: { name: string; categoryId: string; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; allDay?: boolean; notes?: string }) {
    const id = `h${Date.now()}`;
    const now = new Date().toISOString();
    setHabits((s) => [
      ...s,
      { id, categoryId: payload.categoryId, name: payload.name, active: true, type: payload.type, duration: payload.duration, reminders: payload.reminders, dueDate: payload.dueDate, time: payload.time, allDay: payload.allDay, notes: payload.notes, createdAt: now, updatedAt: now },
    ]);
  }

  const selectedHabits = habits.filter((h) => h.categoryId === selectedCategory);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  function toggleCategory(id: string) {
    setOpenCategories((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      {/* Left pane */}
      <aside className="w-80 border-r border-zinc-200 bg-white dark:bg-[#071013] p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">VOW</h2>
          <button className="text-sm text-zinc-500">⋯</button>
        </div>

        <nav className="space-y-2">
          {categories.map((c) => {
            const isOpen = !!openCategories[c.id];
            return (
              <div key={c.id}>
                <div
                  className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 ${selectedCategory === c.id ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                  onClick={() => {
                    toggleCategory(c.id);
                    setSelectedCategory(c.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-3 ${isOpen ? '' : ''}`}>{isOpen ? '▾' : '▸'}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{habits.filter(h => h.categoryId === c.id).length}</div>
                </div>
                {isOpen && (
                  <div className="ml-6 mt-1 flex flex-col gap-1">
                    {habits.filter(h => h.categoryId === c.id).map(h => (
                      <button key={h.id} onClick={() => setSelectedCategory(c.id)} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5">
                        <span>📄</span>
                        <span className="truncate">{h.name}</span>
                      </button>
                    ))}
                    {habits.filter(h => h.categoryId === c.id).length === 0 && (
                      <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex gap-2 pt-4">
          <button
            className="flex-1 rounded border px-3 py-2 text-sm"
            onClick={() => setOpenNewCategory(true)}
          >
            + New Category
          </button>
          <button
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => setOpenNewHabit(true)}
          >
            + New Habbit
          </button>
        </div>
      </aside>

      {/* Right pane */}
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">Today</div>
            <div className="mt-2 text-2xl font-bold">3 / 5</div>
            <div className="mt-1 text-sm text-zinc-500">Completed habits</div>
          </div>
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">Streak</div>
            <div className="mt-2 text-2xl font-bold">12</div>
            <div className="mt-1 text-sm text-zinc-500">days</div>
          </div>
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">This week</div>
            <div className="mt-2 text-2xl font-bold">7</div>
            <div className="mt-1 text-sm text-zinc-500">completed</div>
          </div>
        </div>

        <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
          <h2 className="mb-3 text-lg font-medium">Recent Activity</h2>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600">
            <li>早起き — completed</li>
            <li>メール確認 — skipped</li>
            <li>タスクレビュー — completed</li>
          </ul>
        </section>
      </main>

      <NewCategoryModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        onCreate={(payload) => createCategory(payload)}
      />

      <NewHabitModal
        open={openNewHabit}
        onClose={() => setOpenNewHabit(false)}
        onCreate={(payload) => createHabit(payload)}
        categories={categories}
      />
    </div>
  );
}
