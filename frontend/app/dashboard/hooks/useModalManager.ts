"use client";

import { useState } from 'react';

export function useModalManager() {
  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openNewHabit, setOpenNewHabit] = useState(false);
  const [openHabitModal, setOpenHabitModal] = useState(false);
  const [editLayoutOpen, setEditLayoutOpen] = useState(false);
  const [openGoalModal, setOpenGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  return {
    openNewCategory,
    setOpenNewCategory,
    openNewHabit,
    setOpenNewHabit,
    openHabitModal,
    setOpenHabitModal,
    editLayoutOpen,
    setEditLayoutOpen,
    openGoalModal,
    setOpenGoalModal,
    editingGoalId,
    setEditingGoalId
  };
}