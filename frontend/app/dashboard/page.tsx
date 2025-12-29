"use client";

import { useState } from "react";
import { NewCategoryModal, NewHabitModal } from "./components/modals";

type Category = { id: string; name: string; details?: string; dueDate?: string; createdAt: string; updatedAt: string };
type Habit = { id: string; categoryId: string; name: string; active: boolean; type: "do" | "avoid"; duration?: number; reminders?: { time: string; weekdays: string[] }[]; createdAt: string; updatedAt: string };

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

  function createHabit(payload: { name: string; categoryId: string; type: "do" | "avoid"; duration?: number; reminders?: { time: string; weekdays: string[] }[] }) {
    const id = `h${Date.now()}`;
    const now = new Date().toISOString();
    setHabits((s) => [
      ...s,
      { id, categoryId: payload.categoryId, name: payload.name, active: true, type: payload.type, duration: payload.duration, reminders: payload.reminders, createdAt: now, updatedAt: now },
    ]);
  }

  const selectedHabits = habits.filter((h) => h.categoryId === selectedCategory);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      {/* Left pane */}
      <aside className="w-80 border-r border-zinc-200 bg-white dark:bg-[#0b0b0b] p-4">
        <h2 className="mb-3 text-lg font-semibold">Categories</h2>
        <div className="mb-4 flex flex-col gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-white/5 ${
                selectedCategory === c.id ? "bg-zinc-100 dark:bg-white/5" : ""
              }`}
            >
              <span className="inline-block w-3">📁</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <h3 className="mb-2 text-sm font-medium">Habits</h3>
        <div className="mb-4 flex flex-col gap-2">
          {selectedHabits.length === 0 && (
            <div className="px-3 text-sm text-zinc-500">No habits</div>
          )}
          {selectedHabits.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded px-3 py-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <span className="font-medium">{h.name}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {h.type === "do" ? "やる" : "やらない"}
                  {h.duration ? ` • ${h.duration}分` : ""}
                  {h.reminders && h.reminders.length > 0 ? ` • ${h.reminders.length} reminders` : ""}
                </div>
              </div>
              <div>
                <input
                  type="checkbox"
                  checked={h.active}
                  onChange={() =>
                    setHabits((prev) => prev.map((p) => (p.id === h.id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p)))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex gap-2">
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
