"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

// build a list of time options (15-minute increments) with localized labels
function buildTimeOptions() {
  const opts: { label: string; value: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date()
      d.setHours(h, m, 0, 0)
      const label = d.toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' })
      const value = d.toTimeString().slice(0, 5)
      opts.push({ label, value })
    }
  }
  return opts
}

type Goal = { id: string; name: string; details?: string; dueDate?: string | Date | null }


type HabitPayload = {
  name: string
  goalId: string
  type: "do" | "avoid"
  dueDate?: string
  time?: string
  endTime?: string
  repeat?: string
  allDay?: boolean
  notes?: string
  policy?: "Schedule" | "Count"
  targetCount?: number
}

export function NewGoalModal({ open, onClose, onCreate, goals }: { open: boolean; onClose: () => void; onCreate: (c: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => void; goals?: Goal[] }) {
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [parentId, setParentId] = useState<string | null>(null)

  if (!open) return null

  function handleCreate() {
    onCreate({ name: name.trim(), details: details.trim() || undefined, dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined, parentId: parentId ?? undefined })
    setName("")
    setDetails("")
    setDueDate(undefined)
    setParentId(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
  <h3 className="mb-4 text-lg font-semibold">New Goal</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Goal name" />
          </div>

          <div>
            <label className="block text-sm">Details</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Optional details" />
          </div>

          <div>
            <label className="block text-sm">Due date</label>
            <div className="mt-1">
              <Popover className="relative">
                <Popover.Button className="w-full text-left rounded border px-3 py-2">{dueDate ? dueDate.toDateString() : "Select date"}</Popover.Button>
                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                  <div className="rounded bg-white p-4 shadow max-w-full">
                    <DayPicker mode="single" selected={dueDate} onSelect={(d) => setDueDate(d ?? undefined)} />
                  </div>
                </Popover.Panel>
              </Popover>
            </div>
          </div>

          <div>
            <label className="block text-sm">Parent goal (optional)</label>
            <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)} className="w-full rounded border px-3 py-2 mt-1">
              <option value="">(no parent)</option>
              {goals?.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className="px-4 py-2" onClick={onClose}>Cancel</button>
            <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={handleCreate}>Create</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewFrameModal({ open, onClose, onCreate, initialDate, initialTime }: { open: boolean; onClose: () => void; onCreate: (f: { name?: string; kind: 'Blank' | 'Full'; date?: string; start_time: string; end_time: string; color?: string }) => void; initialDate?: string | Date; initialTime?: string }) {
  const now = new Date()
  const fmtTime = (d: Date) => d.toTimeString().slice(0,5)
  const parseDate = (d?: string | Date) => {
    if (!d) return undefined
    return typeof d === 'string' ? new Date(d) : d
  }

  const [name, setName] = useState<string>("")
  const [kind, setKind] = useState<'Blank' | 'Full'>('Blank')
  const [date, setDate] = useState<Date | undefined>(parseDate(initialDate))
  const [startTime, setStartTime] = useState<string>(initialTime ?? fmtTime(now))
  const [endTime, setEndTime] = useState<string>(fmtTime(new Date(now.getTime() + 30 * 60 * 1000)))
  const [color, setColor] = useState<string>("#60A5FA")

  if (!open) return null

  function handleCreate() {
    onCreate({ name: name.trim() || undefined, kind, date: date ? date.toISOString().slice(0,10) : undefined, start_time: startTime, end_time: endTime, color })
    setName("")
    setKind('Blank')
    setDate(undefined)
    setStartTime(fmtTime(now))
    setEndTime(fmtTime(new Date(now.getTime() + 30 * 60 * 1000)))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
        <h3 className="mb-4 text-lg font-semibold">New Frame</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Frame name" />
          </div>

          <div>
            <label className="block text-sm">Type</label>
            <div className="mt-1 flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="frame-kind" value="Blank" checked={kind === 'Blank'} onChange={() => setKind('Blank')} />
                <span className="text-sm">Blank (free)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="frame-kind" value="Full" checked={kind === 'Full'} onChange={() => setKind('Full')} />
                <span className="text-sm">Full (scheduled)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm">Date</label>
            <div className="mt-1">
              <Popover className="relative">
                <Popover.Button className="w-full text-left rounded border px-3 py-2">{date ? date.toDateString() : 'Select date'}</Popover.Button>
                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                  <div className="rounded bg-white p-4 shadow max-w-full">
                    <DayPicker mode="single" selected={date} onSelect={(d) => setDate(d ?? undefined)} />
                  </div>
                </Popover.Panel>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="w-1/2">
              <label className="block text-sm">Start</label>
              <div className="mt-1 rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                <Popover className="relative">
                  <Popover.Button className="w-full text-left px-3 py-2 text-sm">{startTime}</Popover.Button>
                  <Popover.Panel className="absolute z-50 mt-2 left-0 w-40">
                    <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                      <div className="max-h-56 overflow-auto">
                        {buildTimeOptions().map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setStartTime(opt.value)} className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${startTime === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  </Popover.Panel>
                </Popover>
              </div>
            </div>

            <div className="w-1/2">
              <label className="block text-sm">End</label>
              <div className="mt-1 rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                <Popover className="relative">
                  <Popover.Button className="w-full text-left px-3 py-2 text-sm">{endTime}</Popover.Button>
                  <Popover.Panel className="absolute z-50 mt-2 left-0 w-40">
                    <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                      <div className="max-h-56 overflow-auto">
                        {buildTimeOptions().map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setEndTime(opt.value)} className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${endTime === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  </Popover.Panel>
                </Popover>
              </div>
            </div>
          </div>

          {kind === 'Full' && (
            <div>
              <label className="block text-sm">Color (optional)</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} className="w-full rounded border px-3 py-2" />
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button className="px-4 py-2" onClick={onClose}>Cancel</button>
            <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={handleCreate}>Create</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewHabitModal({ open, onClose, onCreate, categories: goals, initialDate, initialTime, initialType }: { open: boolean; onClose: () => void; onCreate: (p: HabitPayload) => void; categories: Goal[]; initialDate?: string | Date; initialTime?: string; initialType?: "do" | "avoid" }) {
  const now = new Date()
  const defaultStart = new Date(now)
  const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000)
  const fmtTime = (d: Date) => d.toTimeString().slice(0,5)

  const [name, setName] = useState("")
  const [goalId, setGoalId] = useState<string | undefined>(goals?.[0]?.id)
  const [type, setType] = useState<"do" | "avoid">(initialType ?? "do")
  const parseInitialDate = (d?: string | Date) => {
    if (!d) return defaultStart
    const x = typeof d === 'string' ? new Date(d) : d
    if (isNaN(x.getTime())) return defaultStart
    return x
  }

  const [dueDate, setDueDate] = useState<Date | undefined>(parseInitialDate(initialDate))
  const [startTime, setStartTime] = useState<string | undefined>(initialTime ?? fmtTime(defaultStart))
  // derive endTime: if initialTime provided, default to +1 hour; otherwise use defaultEnd
  function addMinutesToTime(t: string, minutes: number) {
    const [hh, mm] = t.split(':').map((s) => Number(s))
    if (Number.isNaN(hh) || Number.isNaN(mm)) return t
    const d = new Date()
    d.setHours(hh, mm, 0, 0)
    d.setMinutes(d.getMinutes() + minutes)
    return d.toTimeString().slice(0,5)
  }
  const [endTime, setEndTime] = useState<string | undefined>(initialTime ? addMinutesToTime(initialTime, 60) : fmtTime(defaultEnd))
  const [policy, setPolicy] = useState<"Schedule" | "Count">("Schedule")
  const [targetCount, setTargetCount] = useState<number | undefined>(undefined)
  const [allDay, setAllDay] = useState<boolean>(false)
  const [repeat, setRepeat] = useState<string>("Does not repeat")
  const [repeatOn, setRepeatOn] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [startPickerTab, setStartPickerTab] = useState<'time' | 'datetime'>('time')
  const [endPickerTab, setEndPickerTab] = useState<'time' | 'datetime'>('time')
  // Custom recurrence state
  const [customInterval, setCustomInterval] = useState<number>(1)
  const [customUnit, setCustomUnit] = useState<"Daily" | "Weekly" | "Monthly" | "Yearly">("Weekly")
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([])
  const [endOption, setEndOption] = useState<"never" | "onDate" | "after">("never")
  const [endDateCustom, setEndDateCustom] = useState<Date | undefined>(undefined)
  const [occurrences, setOccurrences] = useState<number>(1)

  function toggleWeekday(idx: number) {
    setCustomWeekdays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))
  }

  if (!open) return null

  function handleCreate() {
    // derive a simple repeat string from custom recurrence inputs when enabled
    const repeatVal = repeatOn ? customUnit : (repeat === 'Does not repeat' ? undefined : repeat)

    const payload: HabitPayload = {
      name: name.trim() || "Untitled",
      goalId: goalId ?? goals?.[0]?.id ?? "",
      type,
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
      time: startTime ?? undefined,
      endTime: endTime ?? undefined,
      repeat: repeatVal ?? undefined,
      allDay,
      notes: notes.trim() || undefined,
      policy,
      targetCount: targetCount ?? undefined,
    }
    onCreate(payload)
    // reset
    setName("")
  setGoalId(goals?.[0]?.id)
  setType(initialType ?? "do")
    setDueDate(undefined)
    setStartTime("02:00")
    setEndTime("03:00")
    setPolicy("Schedule")
    setTargetCount(undefined)
    setAllDay(false)
    setRepeat("Does not repeat")
    setNotes("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-[720px] rounded bg-white p-4 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">New Habit</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add title" className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />

            <div className="mt-3">
              <label className="block text-sm">Policy</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="policy" value="Schedule" checked={policy === 'Schedule'} onChange={() => setPolicy('Schedule')} />
                  <span className="text-sm">Schedule</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="policy" value="Count" checked={policy === 'Count'} onChange={() => setPolicy('Count')} />
                  <span className="text-sm">Count</span>
                </label>
              </div>

              {policy === 'Schedule' && (
                <div className="mt-4">
                  <div className="text-sm mb-2">Start</div>
                  <div className="mt-1 flex items-end gap-2">
                    <div className="w-36">
                      <div className="text-xs text-slate-500 mb-1">Date</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2">{dueDate ? dueDate.toDateString() : 'Select date'}</Popover.Button>
                          <Popover.Panel className={`absolute z-10 mt-2 left-0 w-[min(380px,90vw)]`}>
                            <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <DayPicker mode="single" selected={dueDate} onSelect={(d) => { setDueDate(d ?? undefined); }} />
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="text-xs text-slate-500 mb-1">Start</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" aria-label="Open start picker" onClick={() => setStartPickerTab('time')}>
                            <span className="inline-block">{startTime ?? '--:--'}</span>
                          </Popover.Button>
                          <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                            <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <div className="max-h-56 overflow-auto">
                                {buildTimeOptions().map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setStartTime(opt.value); }}
                                    className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${startTime === opt.value ? 'bg-sky-600 text-white' : ''}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="text-xs text-slate-500 mb-1">End</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" aria-label="Open end picker" onClick={() => setEndPickerTab('time')}>
                            <span className="inline-block">{endTime ?? '--:--'}</span>
                          </Popover.Button>
                          <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                            <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <div className="max-h-56 overflow-auto">
                                {buildTimeOptions().map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setEndTime(opt.value); }}
                                    className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${endTime === opt.value ? 'bg-sky-600 text-white' : ''}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {policy === 'Count' && (
                <div className="mt-3">
                  <label className="block text-sm">Target count</label>
                  <input type="number" min={1} value={targetCount ?? ''} onChange={(e) => setTargetCount(Number(e.target.value) || undefined)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-sm">Repeat</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="repeat-onoff" value="off" checked={!repeatOn} onChange={() => { setRepeatOn(false); setRepeat('Does not repeat'); }} />
                  <span className="text-sm">Off</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="repeat-onoff" value="on" checked={repeatOn} onChange={() => { setRepeatOn(true); setRepeat('Custom...'); }} />
                  <span className="text-sm">On</span>
                </label>
              </div>

            <div className="mt-3">
              <label className="block text-sm">Type</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="new-habit-type"
                    value="do"
                    checked={type === 'do'}
                    onChange={() => setType('do')}
                    className="form-radio"
                  />
                  <span className="text-sm">Good</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="new-habit-type"
                    value="avoid"
                    checked={type === 'avoid'}
                    onChange={() => setType('avoid')}
                    className="form-radio"
                  />
                  <span className="text-sm">Bad</span>
                </label>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Good = show on calendar. Bad = track but hide from calendar.</div>
            </div>

              {repeatOn && (
                <div className="mt-2 rounded border p-3 bg-gray-50 dark:bg-slate-800">
                  <div className="text-sm font-medium mb-2">Custom recurrence</div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">Repeat every</span>
                    <input
                      type="number"
                      min={1}
                      value={customInterval}
                      onChange={(e) => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded border px-2 py-1"
                    />
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as "Daily" | "Weekly" | "Monthly" | "Yearly")}
                      className="rounded border px-2 py-1"
                    >
                      <option value="Daily">Day(s)</option>
                      <option value="Weekly">Week(s)</option>
                      <option value="Monthly">Month(s)</option>
                      <option value="Yearly">Year(s)</option>
                    </select>
                  </div>

                  {customUnit === "Weekly" && (
                    <div className="mb-3">
                      <div className="text-sm mb-2">Weekdays</div>
                      <div className="flex gap-2">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleWeekday(idx)}
                            className={
                              customWeekdays.includes(idx)
                                ? 'px-3 py-1 rounded-full bg-sky-600 text-white text-sm'
                                : 'px-3 py-1 rounded-full bg-white border text-sm'
                            }
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm mb-2">Ends</div>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="endOption" checked={endOption === 'never'} onChange={() => setEndOption('never')} />
                      <span className="text-sm">Never</span>
                    </label>

                    <label className="flex items-center gap-2 mt-2">
                      <input type="radio" name="endOption" checked={endOption === 'onDate'} onChange={() => setEndOption('onDate')} />
                      <span className="text-sm">On date</span>
                    </label>

                    {endOption === 'onDate' && (
                      <div className="mt-2">
                        <Popover className="relative">
                          <Popover.Button className="rounded border px-3 py-2">{endDateCustom ? endDateCustom.toDateString() : 'Select date'}</Popover.Button>
                          <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(320px,90vw)]">
                            <div className="rounded bg-white p-3 shadow">
                              <DayPicker mode="single" selected={endDateCustom} onSelect={(d) => setEndDateCustom(d ?? undefined)} />
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    )}

                    <label className="flex items-center gap-2 mt-2">
                      <input type="radio" name="endOption" checked={endOption === 'after'} onChange={() => setEndOption('after')} />
                      <span className="text-sm">After</span>
                    </label>

                    {endOption === 'after' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input type="number" min={1} value={occurrences} onChange={(e) => setOccurrences(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded border px-2 py-1" />
                        <span className="text-sm">occurrence(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-sm">Description</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" placeholder="Add description" />
            </div>
          </div>

          <div className="w-72">
            <div className="rounded border bg-gray-50 dark:bg-slate-800 p-3">
                      <div className="text-sm font-medium mb-2">Goal</div>
                      <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        {goals.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 mr-2 text-black dark:text-slate-100">Cancel</button>
          <button onClick={handleCreate} className="rounded bg-blue-600 px-4 py-2 text-white">Save</button>
        </div>
      </div>
    </div>
  )
}

type Habit = { id: string; goalId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; policy?: "Schedule" | "Count"; targetCount?: number; createdAt: string; updatedAt: string }

export function HabitModal({ open, onClose, habit, onUpdate, onDelete, categories: goals }: { open: boolean; onClose: () => void; habit: Habit | null; onUpdate: (h: Habit) => void; onDelete: (id: string) => void; categories?: Goal[] }) {
  // Initialize editable state from habit. The caller should key the modal by habit id so a new
  // component instance is created when a different habit is opened.
  const [name, setName] = useState<string>(habit?.name ?? "")
  const [notes, setNotes] = useState<string>(habit?.notes ?? "")
  const [dueDate, setDueDate] = useState<Date | undefined>(habit?.dueDate ? new Date(habit.dueDate) : undefined)
  const [time, setTime] = useState<string | undefined>(habit?.time ?? undefined)
  const [endTime, setEndTime] = useState<string | undefined>(undefined)
  const [allDay, setAllDay] = useState<boolean>(!!habit?.allDay)
  const [active, setActive] = useState<boolean>(!!habit?.active)
  const [type, setType] = useState<"do" | "avoid">(habit?.type ?? "do")
  const [policy, setPolicy] = useState<"Schedule" | "Count">("Schedule")
  const [targetCount, setTargetCount] = useState<number | undefined>(undefined)
  // repeat / recurrence fields (simple)
  const [repeat, setRepeat] = useState<string>("Does not repeat")
  const [repeatOn, setRepeatOn] = useState<boolean>(false)
  const [goalId, setGoalId] = useState<string | undefined>(habit?.goalId)
  const [startPickerTab, setStartPickerTab] = useState<'time' | 'datetime'>('time')
  const [endPickerTab, setEndPickerTab] = useState<'time' | 'datetime'>('time')

  // Custom recurrence state (copied from NewHabitModal so edit popup matches)
  const [customInterval, setCustomInterval] = useState<number>(1)
  const [customUnit, setCustomUnit] = useState<"Daily" | "Weekly" | "Monthly" | "Yearly">("Weekly")
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([])
  const [endOption, setEndOption] = useState<"never" | "onDate" | "after">("never")
  const [endDateCustom, setEndDateCustom] = useState<Date | undefined>(undefined)
  const [occurrences, setOccurrences] = useState<number>(1)

  function toggleWeekday(idx: number) {
    setCustomWeekdays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))
  }

  if (!open || !habit) return null

  // initialize policy/targetCount from habit when modal opens
  React.useEffect(() => {
    setPolicy(habit?.policy ?? 'Schedule')
    setTargetCount(habit?.targetCount ?? habit?.must ?? undefined)
    setName(habit?.name ?? '')
    setNotes(habit?.notes ?? '')
    setDueDate(habit?.dueDate ? new Date(habit.dueDate) : undefined)
    setTime(habit?.time ?? undefined)
    setEndTime(habit?.endTime ?? undefined)
    setAllDay(!!habit?.allDay)
    setActive(!!habit?.active)
    setType(habit?.type ?? 'do')
  setGoalId(habit?.goalId)
    setRepeat(habit?.repeat ?? 'Does not repeat')
    setRepeatOn((habit?.repeat ?? 'Does not repeat') !== 'Does not repeat')
    // initialize customUnit so the UI shows Daily/Weekly/Monthly correctly when editing
    if (habit?.repeat && habit.repeat !== 'Does not repeat') {
      if (habit.repeat === 'Daily' || habit.repeat === 'Weekly' || habit.repeat === 'Monthly' || habit.repeat === 'Yearly') {
        setCustomUnit(habit.repeat as "Daily" | "Weekly" | "Monthly" | "Yearly")
      }
    }
  }, [habit])

  function handleSave() {
    // derive repeat value from custom options
    let repeatVal: string | undefined = undefined
    if (repeatOn) {
      // prefer explicit customUnit (Daily/Weekly/etc.)
      repeatVal = customUnit
    } else if (repeat && repeat !== 'Does not repeat') {
      repeatVal = repeat
    }

    const updated: Habit = {
      ...habit!,
      id: habit!.id,
      goalId: goalId ?? habit!.goalId,
      name: name.trim() || "Untitled",
      notes: notes.trim() || undefined,
      time: time ?? undefined,
      allDay,
      active,
      type,
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
  // include policy/targetCount/must from this UI
  policy,
  ...(targetCount ? { targetCount } as any : {}),
  ...(targetCount ? { must: targetCount } as any : {}),
  // store simple repeat string and endTime for now
  repeat: repeatVal,
  endTime,
      updatedAt: new Date().toISOString(),
    }
    onUpdate(updated)
    onClose()
  }

  function handleDelete() {
    if (habit) onDelete(habit.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-[720px] rounded bg-white p-4 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Habit</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add title" className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />

            <div className="mt-3">
              <label className="block text-sm">Policy</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name={`policy-${habit.id}`} value="Schedule" checked={policy === 'Schedule'} onChange={() => setPolicy('Schedule')} />
                  <span className="text-sm">Schedule</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name={`policy-${habit.id}`} value="Count" checked={policy === 'Count'} onChange={() => setPolicy('Count')} />
                  <span className="text-sm">Count</span>
                </label>
              </div>

              {policy === 'Schedule' && (
                <div className="mt-4">
                  <div className="text-sm mb-2">Start</div>
                  <div className="mt-1 flex items-end gap-2">
                    <div className="w-36">
                      <div className="text-xs text-slate-500 mb-1">Date</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2">{dueDate ? dueDate.toDateString() : 'Select date'}</Popover.Button>
                          <Popover.Panel className={`absolute z-10 mt-2 left-0 w-[min(380px,90vw)]`}>
                            <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <DayPicker mode="single" selected={dueDate} onSelect={(d) => { setDueDate(d ?? undefined); }} />
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="text-xs text-slate-500 mb-1">Start</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" aria-label="Open start picker" onClick={() => setStartPickerTab('time')}>
                            <span className="inline-block">{time ?? '--:--'}</span>
                          </Popover.Button>
                          <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                            <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <div className="max-h-56 overflow-auto">
                                {buildTimeOptions().map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setTime(opt.value); }}
                                    className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${time === opt.value ? 'bg-sky-600 text-white' : ''}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="text-xs text-slate-500 mb-1">End</div>
                      <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                        <Popover className="relative">
                          <Popover.Button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" aria-label="Open end picker" onClick={() => setEndPickerTab('time')}>
                            <span className="inline-block">{endTime ?? '--:--'}</span>
                          </Popover.Button>
                          <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                            <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                              <div className="max-h-56 overflow-auto">
                                {buildTimeOptions().map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setEndTime(opt.value); }}
                                    className={`w-full text-left px-2 py-1 hover:bg-gray-100 ${endTime === opt.value ? 'bg-sky-600 text-white' : ''}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {policy === 'Count' && (
                <div className="mt-3">
                  <label className="block text-sm">Target count</label>
                  <input type="number" min={1} value={targetCount ?? ''} onChange={(e) => setTargetCount(Number(e.target.value) || undefined)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-sm">Repeat</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name={`repeat-onoff-${habit.id}`} value="off" checked={!repeatOn} onChange={() => { setRepeatOn(false); setRepeat('Does not repeat'); }} />
                  <span className="text-sm">Off</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name={`repeat-onoff-${habit.id}`} value="on" checked={repeatOn} onChange={() => { setRepeatOn(true); setRepeat('Custom...'); }} />
                  <span className="text-sm">On</span>
                </label>
              </div>

            <div className="mt-3">
              <label className="block text-sm">Type</label>
              <div className="mt-1 flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="habit-type"
                    value="do"
                    checked={type === 'do'}
                    onChange={() => setType('do')}
                    className="form-radio"
                  />
                  <span className="text-sm">Good</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="habit-type"
                    value="avoid"
                    checked={type === 'avoid'}
                    onChange={() => setType('avoid')}
                    className="form-radio"
                  />
                  <span className="text-sm">Bad</span>
                </label>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Good = show on calendar. Bad = track but hide from calendar.</div>
            </div>

              {repeatOn && (
                <div className="mt-2 rounded border p-3 bg-gray-50 dark:bg-slate-800">
                  <div className="text-sm font-medium mb-2">Custom recurrence</div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">Repeat every</span>
                    <input
                      type="number"
                      min={1}
                      value={customInterval}
                      onChange={(e) => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded border px-2 py-1"
                    />
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as "Daily" | "Weekly" | "Monthly" | "Yearly")}
                      className="rounded border px-2 py-1"
                    >
                      <option value="Daily">Day(s)</option>
                      <option value="Weekly">Week(s)</option>
                      <option value="Monthly">Month(s)</option>
                      <option value="Yearly">Year(s)</option>
                    </select>
                  </div>

                  {customUnit === "Weekly" && (
                    <div className="mb-3">
                      <div className="text-sm mb-2">Weekdays</div>
                      <div className="flex gap-2">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleWeekday(idx)}
                            className={
                              customWeekdays.includes(idx)
                                ? 'px-3 py-1 rounded-full bg-sky-600 text-white text-sm'
                                : 'px-3 py-1 rounded-full bg-white border text-sm'
                            }
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm mb-2">Ends</div>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="endOption" checked={endOption === 'never'} onChange={() => setEndOption('never')} />
                      <span className="text-sm">Never</span>
                    </label>

                    <label className="flex items-center gap-2 mt-2">
                      <input type="radio" name="endOption" checked={endOption === 'onDate'} onChange={() => setEndOption('onDate')} />
                      <span className="text-sm">On date</span>
                    </label>

                    {endOption === 'onDate' && (
                      <div className="mt-2">
                        <Popover className="relative">
                          <Popover.Button className="rounded border px-3 py-2">{endDateCustom ? endDateCustom.toDateString() : 'Select date'}</Popover.Button>
                          <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(320px,90vw)]">
                            <div className="rounded bg-white p-3 shadow">
                              <DayPicker mode="single" selected={endDateCustom} onSelect={(d) => setEndDateCustom(d ?? undefined)} />
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    )}

                    <label className="flex items-center gap-2 mt-2">
                      <input type="radio" name="endOption" checked={endOption === 'after'} onChange={() => setEndOption('after')} />
                      <span className="text-sm">After</span>
                    </label>

                    {endOption === 'after' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input type="number" min={1} value={occurrences} onChange={(e) => setOccurrences(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded border px-2 py-1" />
                        <span className="text-sm">occurrence(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-sm">Description</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" placeholder="Add description" />
            </div>
          </div>

          <div className="w-72">
            <div className="rounded border bg-gray-50 dark:bg-slate-800 p-3">
              <div className="text-sm font-medium mb-2">Goal</div>
              <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                {(goals ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 mr-2 text-black dark:text-slate-100">Cancel</button>
          <button onClick={handleSave} className="rounded bg-blue-600 px-4 py-2 text-white">Save</button>
        </div>
      </div>
    </div>
  )
}
