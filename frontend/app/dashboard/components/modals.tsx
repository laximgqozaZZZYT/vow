"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

// Lightweight, safer implementation of the modals used by the dashboard MOC.

type Category = { id: string; name: string; details?: string; dueDate?: string | Date | null }

type AbsoluteReminder = { kind: "absolute"; time: string; weekdays: number[] }
type RelativeReminder = { kind: "relative"; minutesBefore: number }
type NoneReminder = { kind: "none" }
type Reminder = AbsoluteReminder | RelativeReminder | NoneReminder

type Habit = {
  id: string
  categoryId: string
  name: string
  active: boolean
  type: "do" | "avoid"
  durationMinutes?: number
  reminders?: Reminder[]
}

export function NewCategoryModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (payload: { name: string; details?: string; dueDate?: string }) => void
}) {
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)

  if (!open) return null

  function handleCreate() {
    onCreate({ name: name.trim(), details: details.trim() || undefined, dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined })
    setName("")
    setDetails("")
    setDueDate(undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
        <h3 className="mb-4 text-lg font-semibold">New Category</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" placeholder="Category name" />
          </div>

          <div>
            <label className="block text-sm">Details</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" placeholder="Optional details" />
          </div>

          <div>
            <label className="block text-sm">Due date</label>
            <div className="mt-1">
              <Popover className="relative">
                <Popover.Button className="w-full text-left rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                  {dueDate ? dueDate.toDateString() : "Select date"}
                </Popover.Button>
                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                  <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                    <DayPicker mode="single" selected={dueDate} onSelect={(d) => setDueDate(d ?? undefined)} className="w-full" />
                  </div>
                </Popover.Panel>
              </Popover>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className="px-4 py-2 text-black dark:text-slate-100" onClick={onClose}>Cancel</button>
            <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={handleCreate}>Create</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewHabitModal({
  open,
  onClose,
  onCreate,
  categories,
}: {
  open: boolean
  onClose: () => void
  onCreate: (payload: { name: string; categoryId: string; type: "do" | "avoid"; duration?: number; reminders?: any[] }) => void
  categories: Category[]
}) {
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>(categories?.[0]?.id)
  const [type, setType] = useState<Habit["type"]>("do")
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(30)
  const [reminders, setReminders] = useState<Reminder[]>([{ kind: "none" }])

  function addAbsoluteReminder() {
    setReminders((r) => [...r, { kind: "absolute", time: "09:00", weekdays: [1, 2, 3, 4, 5] }])
  }
  function addRelativeReminder() {
    setReminders((r) => [...r, { kind: "relative", minutesBefore: 60 }])
  }
  function removeReminder(idx: number) {
    setReminders((r) => r.filter((_, i) => i !== idx))
  }

  function handleCreate() {
    onCreate({ name: name.trim(), categoryId: categoryId ?? categories?.[0]?.id ?? "", type, duration: durationMinutes ?? undefined, reminders })
    setName("")
    setCategoryId(categories?.[0]?.id)
    setType("do")
    setDurationMinutes(30)
    setReminders([{ kind: "none" }])
    onClose()
  }

  const presetButtons = [15, 30, 45, 60]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">New habit</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border-slate-200 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2" placeholder="What do you want to do?" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 block w-full rounded-md border-slate-200 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setType("do")} className={type === "do" ? "px-3 py-2 rounded-md text-sm bg-sky-600 text-white" : "px-3 py-2 rounded-md text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}>
                Do
              </button>
              <button type="button" onClick={() => setType("avoid")} className={type === "avoid" ? "px-3 py-2 rounded-md text-sm bg-sky-600 text-white" : "px-3 py-2 rounded-md text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}>
                Avoid
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estimate duration</label>
          <div className="mt-1 flex gap-2 items-center">
            <div className="flex gap-2">
              {presetButtons.map((m) => (
                <button key={m} type="button" onClick={() => setDurationMinutes(m)} className={durationMinutes === m ? "px-3 py-2 rounded-md text-sm bg-sky-600 text-white" : "px-3 py-2 rounded-md text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}>
                  {m}m
                </button>
              ))}
            </div>

            <input type="number" value={durationMinutes ?? ""} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="ml-3 w-28 rounded-md border-slate-200 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2" placeholder="mins" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reminders</label>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <button type="button" onClick={addAbsoluteReminder} className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">Add time reminder</button>
              <button type="button" onClick={addRelativeReminder} className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">Add relative reminder</button>
            </div>

            {reminders.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded-md border p-2 bg-white dark:bg-slate-800">
                <div>
                  {r.kind === "absolute" ? (
                    <div>
                      <div className="text-sm font-medium">Time</div>
                      <div>{r.time} — {r.weekdays.join(", ")}</div>
                    </div>
                  ) : r.kind === "relative" ? (
                    <div>{r.minutesBefore} minutes before</div>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No reminder</div>
                  )}
                </div>

                <div>
                  <button type="button" onClick={() => removeReminder(idx)} className="px-2 py-1 rounded-md bg-red-50 dark:bg-red-700 text-red-700 dark:text-red-100 text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setName(""); setCategoryId(categories?.[0]?.id); setType("do"); setDurationMinutes(30); setReminders([{ kind: "none" }]); onClose() }} className="rounded-md px-3 py-2 text-sm bg-white border border-slate-200">Cancel</button>
            <button type="button" onClick={handleCreate} className="rounded-md px-3 py-2 text-sm bg-sky-600 text-white">Create habit</button>
          </div>
        </div>
      </div>
    </div>
  )
}
    