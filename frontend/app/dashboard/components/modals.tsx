"use client";

import { useState } from "react";
import { Popover } from "@headlessui/react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export function NewCategoryModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; details?: string; dueDate?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg dark:bg-[#111]">
        <h3 className="mb-4 text-lg font-semibold">New Category</h3>
        <label className="block text-sm">Name (必須)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Category name"
        />
        <label className="mt-3 block text-sm">Details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Optional details"
        />
        <label className="mt-3 block text-sm">Due date</label>
        <Popover className="relative">
          <Popover.Button className="w-full text-left rounded border px-3 py-2">
            {dueDate ? dueDate : "Select date"}
          </Popover.Button>
          <Popover.Panel className="absolute z-10 mt-2">
            <div className="rounded bg-white p-2 shadow">
              <DayPicker
                mode="single"
                selected={dueDate ? new Date(dueDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setDueDate(date.toISOString().slice(0, 10));
                  }
                }}
              />
            </div>
          </Popover.Panel>
        </Popover>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (name.trim()) {
                onCreate({ name: name.trim(), details: details.trim() || undefined, dueDate });
                setName("");
                setDetails("");
                setDueDate(undefined);
                onClose();
              }
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewHabitModal({ open, onClose, onCreate, categories }: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; categoryId: string; type: "do" | "avoid"; duration?: number; reminders?: { time: string; weekdays: string[] }[] }) => void;
  categories: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(
    categories?.[0]?.id
  );
  const [type, setType] = useState<"do" | "avoid">("do");
  const [duration, setDuration] = useState<number | undefined>(undefined);

  // reminders: simple list of {time, weekdays}
  const [reminders, setReminders] = useState<{ time: string; weekdays: string[] }[]>([]);
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newReminderDays, setNewReminderDays] = useState<string[]>([]);

  if (!open) return null;

  function addReminder() {
    if (!newReminderTime) return;
    setReminders((r) => [...r, { time: newReminderTime, weekdays: newReminderDays }]);
    setNewReminderTime("");
    setNewReminderDays([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg dark:bg-[#111]">
        <h3 className="mb-4 text-lg font-semibold">New Habbit</h3>
        <label className="block text-sm">Name (必須)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Habbit name"
        />

        <label className="mt-3 block text-sm">Category</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm">Type</label>
        <div className="flex gap-3">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="type" checked={type === "do"} onChange={() => setType("do")} />
            やる
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="type" checked={type === "avoid"} onChange={() => setType("avoid")} />
            やらない
          </label>
        </div>

        <label className="mt-3 block text-sm">Estimated Duration (分)</label>
        <input
          type="number"
          value={duration ?? ""}
          onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full rounded border px-3 py-2"
          placeholder="e.g. 30"
        />

        <label className="mt-3 block text-sm">Reminders</label>
        <div className="mb-2">
          <div className="flex gap-2">
            <input type="time" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} className="rounded border px-2 py-1" />
            <div className="flex gap-1">
              {[
                ["mon", "Mon"],
                ["tue", "Tue"],
                ["wed", "Wed"],
                ["thu", "Thu"],
                ["fri", "Fri"],
                ["sat", "Sat"],
                ["sun", "Sun"],
              ].map(([val, label]) => {
                const active = newReminderDays.includes(String(val));
                return (
                  <button
                    key={String(val)}
                    type="button"
                    className={`rounded px-2 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                    onClick={() => {
                      if (active) setNewReminderDays((d) => d.filter((x) => x !== val));
                      else setNewReminderDays((d) => [...d, String(val)]);
                    }}
                  >
                    {String(label)}
                  </button>
                );
              })}
            </div>
            <button className="rounded bg-gray-200 px-3" onClick={addReminder}>Add</button>
          </div>
        </div>

        <ul className="mb-3 text-sm">
          {reminders.map((r, i) => (
            <li key={i} className="flex items-center justify-between">
              <div>{r.time} — {r.weekdays.join(", ") || "(every day)"}</div>
              <button className="text-sm text-red-500" onClick={() => setReminders(reminders.filter((_, idx) => idx !== i))}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (name.trim() && categoryId) {
                onCreate({ name: name.trim(), categoryId: categoryId!, type, duration, reminders });
                setName("");
                setDuration(undefined);
                setReminders([]);
                onClose();
              }
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
