"use client";

import { useState } from "react";

export function NewCategoryModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg dark:bg-[#111]">
        <h3 className="mb-4 text-lg font-semibold">New Category</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Category name"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (name.trim()) {
                onCreate(name.trim());
                setName("");
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
  onCreate: (name: string, categoryId: string) => void;
  categories: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(
    categories?.[0]?.id
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg dark:bg-[#111]">
        <h3 className="mb-4 text-lg font-semibold">New Habbit</h3>
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
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (name.trim() && categoryId) {
                onCreate(name.trim(), categoryId);
                setName("");
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
