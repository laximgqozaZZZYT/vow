"use client";

import { useState, useMemo, useRef } from "react";
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import rrulePlugin from '@fullcalendar/rrule';
import type { Goal, Habit } from '../types';

interface CalendarWidgetProps {
  habits: Habit[];
  goals: Goal[];
  onEventClick?: (id: string) => void;
  onSlotSelect?: (isoDate: string, time?: string, endTime?: string) => void;
  onEventChange?: (id: string, updated: { start?: string; end?: string; timingIndex?: number }) => void;
  onRecurringAttempt?: (habitId: string, updated: { start?: string; end?: string; timingIndex?: number }) => void;
}

export default function CalendarWidget({ 
  habits, 
  goals, 
  onEventClick, 
  onSlotSelect, 
  onEventChange, 
  onRecurringAttempt 
}: CalendarWidgetProps) {
  const INDEFINITE_HORIZON_DAYS = 365 * 5;
  
  function ymd(d: Date) { 
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  
  function addDays(d: Date, n: number) { 
    const x = new Date(d); 
    x.setDate(x.getDate()+n); 
    return x;
  }
  
  function parseYmd(s?: string) { 
    if (!s) return undefined; 
    const parts = s.split('-').map(x => Number(x)); 
    if (parts.length>=3 && !Number.isNaN(parts[0])) return new Date(parts[0], parts[1]-1, parts[2]); 
    const dd = new Date(s); 
    return isNaN(dd.getTime()) ? undefined : dd;
  }

  function getGoalDueDate(goalId: string): Date | undefined {
    const g = (goals ?? []).find((x) => x.id === goalId);
    return g?.dueDate ? parseYmd(String(g.dueDate)) : undefined;
  }

  function computeExpandDays(base: Date, goalDue?: Date): number {
    const horizon = goalDue ?? addDays(base, INDEFINITE_HORIZON_DAYS);
    const endDay = new Date(horizon);
    endDay.setHours(0, 0, 0, 0);
    const baseDay = new Date(base);
    baseDay.setHours(0, 0, 0, 0);
    const days = Math.ceil((endDay.getTime() - baseDay.getTime()) / (24 * 3600 * 1000));
    return Math.max(1, days + 1);
  }

  const calendarRef = useRef<any>(null);
  const [navSelection, setNavSelection] = useState<'today' | 'tomorrow' | 'week' | 'month'>('today');

  function scrollToNowCenter() {
    const cal = calendarRef.current?.getApi?.();
    if (!cal) return;
    try {
      const now = new Date();
      const seconds = Math.max(0, now.getHours() * 3600 + now.getMinutes() * 60 - 3 * 3600);
      cal.scrollToTime(seconds);
    } catch {
      // ignore
    }
  }

  const events = useMemo(() => {
    const ev: any[] = [];
    const goalsById = Object.fromEntries((goals ?? []).map(g => [g.id, g])) as Record<string, Goal>;
    
    const goalCompleted = (goalId: string) => {
      let g: Goal | undefined = goalsById[goalId];
      while (g) {
        if (g.isCompleted) return true;
        g = g.parentId ? goalsById[g.parentId] : undefined;
      }
      return false;
    };

    for (const h of (habits ?? [])) {
      if (!h.active) continue;
      if (h.completed) continue;
      if (goalCompleted(h.goalId)) continue;
      if (h.type === 'avoid') continue;
      
      const timings = (h as any).timings ?? [];
      
      if (timings.length) {
        for (let ti = 0; ti < timings.length; ti++) {
          const t = timings[ti];
          const evIdBase = `${h.id}-${ti}`;
          
          if (t.type === 'Date' && t.date) {
            if (t.start) {
              ev.push({ 
                title: h.name, 
                start: `${t.date}T${t.start}:00`, 
                end: t.end ? `${t.date}T${t.end}:00` : undefined, 
                allDay: false, 
                id: `${evIdBase}`, 
                editable: true, 
                className: 'vow-habit', 
                extendedProps: { habitId: h.id, timingIndex: ti } 
              });
            } else {
              ev.push({ 
                title: h.name, 
                start: t.date, 
                allDay: true, 
                id: evIdBase, 
                editable: true, 
                className: 'vow-habit', 
                extendedProps: { habitId: h.id, timingIndex: ti } 
              });
            }
          } else {
            const baseDate = t.date ?? h.dueDate ?? new Date().toISOString().slice(0,10);
            
            if (t.start) {
              const base = parseYmd(t.date ?? h.dueDate ?? ymd(new Date())) ?? new Date();
              const goalDue = getGoalDueDate(h.goalId);
              const expandDays = computeExpandDays(base, goalDue);
              
              for (let d = 0; d < expandDays; d++) {
                const day = addDays(base, d);
                const dateS = ymd(day);
                
                if (t.type === 'Weekly') {
                  let weekdays: number[] | null = null;
                  if (t.cron && String(t.cron).startsWith('WEEKDAYS:')) {
                    weekdays = (t.cron.split(':')[1] || '').split(',').map((x: string) => Number(x)).filter((n: number) => !Number.isNaN(n));
                  }
                  if (weekdays && !weekdays.includes(day.getDay())) continue;
                }
                
                if (t.type === 'Monthly') {
                  const ref = parseYmd(t.date);
                  if (ref && ref.getDate() !== day.getDate()) continue;
                }
                
                ev.push({ 
                  title: h.name, 
                  start: `${dateS}T${t.start}:00`, 
                  end: t.end ? `${dateS}T${t.end}:00` : undefined, 
                  allDay: false, 
                  id: `${evIdBase}-${dateS}`, 
                  editable: true, 
                  className: 'vow-habit', 
                  extendedProps: { habitId: h.id, timingIndex: ti } 
                });
              }
            } else {
              ev.push({ 
                title: h.name, 
                start: baseDate, 
                allDay: true, 
                id: evIdBase, 
                editable: true, 
                className: 'vow-habit', 
                extendedProps: { habitId: h.id, timingIndex: ti } 
              });
            }
          }
        }
        continue;
      }

      const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10);
      if ((h as any).time) {
        const startIso = `${dateStr}T${(h as any).time}:00`;
        const endIso = (h as any).endTime ? `${dateStr}T${(h as any).endTime}:00` : undefined;
        ev.push({ 
          title: h.name, 
          start: startIso, 
          end: endIso, 
          allDay: false, 
          id: h.id, 
          editable: true, 
          className: 'vow-habit',
          extendedProps: { habitId: h.id }
        });
      } else {
        ev.push({ 
          title: h.name, 
          start: dateStr, 
          allDay: true, 
          id: h.id, 
          editable: true, 
          className: 'vow-habit',
          extendedProps: { habitId: h.id }
        });
      }
    }
    return ev;
  }, [habits, goals]);

  return (
    <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <h2 className="mb-3 text-lg font-medium">Calendar</h2>
      <div className="mb-3 flex items-center gap-2">
        {(['today','tomorrow','week','month'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              const cal = calendarRef.current?.getApi?.();
              if (!cal) return;
              if (b === 'today') {
                cal.gotoDate(new Date());
                cal.changeView('timeGridDay');
                setNavSelection('today');
                window.setTimeout(() => scrollToNowCenter(), 50);
              } else if (b === 'tomorrow') {
                const t = new Date(); 
                t.setDate(t.getDate() + 1);
                cal.gotoDate(t);
                cal.changeView('timeGridDay');
                setNavSelection('tomorrow');
              } else if (b === 'week') {
                cal.changeView('timeGridWeek');
                setNavSelection('week');
              } else if (b === 'month') {
                cal.changeView('dayGridMonth');
                setNavSelection('month');
              }
            }}
            className={`rounded px-3 py-1 text-sm ${navSelection === b ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-200'}`}
          >
            {b === 'today' ? 'today' : b === 'tomorrow' ? 'tomorrow' : b === 'week' ? 'week' : 'month'}
          </button>
        ))}
      </div>
      
      <FullCalendar
        ref={calendarRef}
        plugins={[ timeGridPlugin, dayGridPlugin, interactionPlugin, rrulePlugin ]}
        initialView={navSelection === 'today' || navSelection === 'tomorrow' ? 'timeGridDay' : navSelection === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
        nowIndicator={true}
        viewDidMount={() => {
          if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0);
        }}
        datesSet={() => {
          if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0);
        }}
        editable={true}
        eventStartEditable={true}
        eventDurationEditable={true}
        eventResizableFromStart={true}
        eventOverlap={true}
        eventConstraint={{
          start: '00:00',
          end: '24:00'
        }}
        headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        selectable={true}
        selectMirror={true}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        select={(selectionInfo) => {
          const iso = selectionInfo.startStr?.slice(0,10) ?? selectionInfo.start?.toISOString().slice(0,10);
          const startTime = selectionInfo.startStr && selectionInfo.startStr.length > 10 ? selectionInfo.startStr.slice(11,16) : undefined;
          const endSrc = (selectionInfo.endStr && selectionInfo.endStr.length > 10)
            ? selectionInfo.endStr
            : (selectionInfo.end ? selectionInfo.end.toISOString() : undefined);
          const endTime = endSrc && endSrc.length > 10 ? endSrc.slice(11,16) : undefined;
          if (onSlotSelect && iso) onSlotSelect(iso, startTime, endTime);
        }}
        eventClick={(clickInfo) => {
          const id = clickInfo.event.id;
          const ext = (clickInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          if (onEventClick) onEventClick(habitId);
        }}
        dateClick={(dateClickInfo) => {
          const iso = dateClickInfo.dateStr?.slice(0,10) ?? dateClickInfo.date?.toISOString().slice(0,10);
          const time = dateClickInfo.dateStr && dateClickInfo.dateStr.length > 10 ? dateClickInfo.dateStr.slice(11,16) : undefined;
          if (onSlotSelect && iso) onSlotSelect(iso, time, undefined);
        }}
        eventDrop={(dropInfo) => {
          const id = dropInfo.event.id;
          const startStr = dropInfo.event.start ? dropInfo.event.start.toISOString() : undefined;
          const endStr = dropInfo.event.end ? dropInfo.event.end.toISOString() : undefined;
          const ext = (dropInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          const timingIndex = ext.timingIndex;
          
          console.log('[Calendar] Event dropped:', { habitId, startStr, endStr, timingIndex, eventId: id });
          
          const habit = habits.find(h => h.id === habitId);
          if (!habit) {
            console.warn('[Calendar] Habit not found:', habitId);
            return;
          }
          
          const timings = habit && (habit as any).timings && Array.isArray((habit as any).timings) ? (habit as any).timings : [];
          console.log('[Calendar] Habit details:', {
            id: habit.id,
            name: habit.name,
            repeat: habit.repeat,
            timings: timings,
            timingsLength: timings.length
          });
          
          // Check if this specific event is editable
          let isEditable = true;
          
          if (typeof timingIndex === 'number' && timings[timingIndex]) {
            // If timingIndex is specified, check the specific timing entry
            const timing = timings[timingIndex];
            console.log(`[Calendar] Checking specific timing ${timingIndex}:`, timing);
            
            // Date type timings are always editable (specific dates, not recurring)
            if (timing.type === 'Date') {
              isEditable = true;
              console.log('[Calendar] Timing is Date type - editable');
            } else if (timing.type === 'Daily' || timing.type === 'Weekly' || timing.type === 'Monthly') {
              isEditable = false;
              console.log('[Calendar] Timing is recurring type - not editable');
            }
          } else {
            // No timingIndex - check if habit has recurring patterns
            const hasRecurringTimings = timings.length > 0 && timings.some((t: any) => 
              t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly'
            );
            const hasRepeat = habit && habit.repeat && habit.repeat !== 'Does not repeat';
            isEditable = !(hasRecurringTimings || hasRepeat);
            console.log('[Calendar] No timingIndex - checking habit level recurring:', { hasRecurringTimings, hasRepeat, isEditable });
          }
          
          if (!isEditable) {
            console.log('[Calendar] Reverting non-editable habit move');
            try { dropInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr });
            return;
          }
          
          if (onEventChange) {
            console.log('[Calendar] Calling onEventChange for editable habit');
            onEventChange(habitId, { start: startStr, end: endStr, timingIndex });
          }
        }}
        eventResize={(resizeInfo) => {
          const id = resizeInfo.event.id;
          const startStr = resizeInfo.event.start ? resizeInfo.event.start.toISOString() : undefined;
          const endStr = resizeInfo.event.end ? resizeInfo.event.end.toISOString() : undefined;
          const ext = (resizeInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          const timingIndex = ext.timingIndex;
          
          console.log('[Calendar] Event resized:', { habitId, startStr, endStr, timingIndex, eventId: id });
          
          const habit = habits.find(h => h.id === habitId);
          if (!habit) {
            console.warn('[Calendar] Habit not found:', habitId);
            return;
          }
          
          const timings = habit && (habit as any).timings && Array.isArray((habit as any).timings) ? (habit as any).timings : [];
          console.log('[Calendar] Habit details:', {
            id: habit.id,
            name: habit.name,
            repeat: habit.repeat,
            timings: timings,
            timingsLength: timings.length
          });
          
          // Check if this specific event is editable
          let isEditable = true;
          
          if (typeof timingIndex === 'number' && timings[timingIndex]) {
            // If timingIndex is specified, check the specific timing entry
            const timing = timings[timingIndex];
            console.log(`[Calendar] Checking specific timing ${timingIndex}:`, timing);
            
            // Date type timings are always editable (specific dates, not recurring)
            if (timing.type === 'Date') {
              isEditable = true;
              console.log('[Calendar] Timing is Date type - editable');
            } else if (timing.type === 'Daily' || timing.type === 'Weekly' || timing.type === 'Monthly') {
              isEditable = false;
              console.log('[Calendar] Timing is recurring type - not editable');
            }
          } else {
            // No timingIndex - check if habit has recurring patterns
            const hasRecurringTimings = timings.length > 0 && timings.some((t: any) => 
              t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly'
            );
            const hasRepeat = habit && habit.repeat && habit.repeat !== 'Does not repeat';
            isEditable = !(hasRecurringTimings || hasRepeat);
            console.log('[Calendar] No timingIndex - checking habit level recurring:', { hasRecurringTimings, hasRepeat, isEditable });
          }
          
          if (!isEditable) {
            console.log('[Calendar] Reverting non-editable habit resize');
            try { resizeInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr });
            return;
          }
          
          if (onEventChange) {
            console.log('[Calendar] Calling onEventChange for editable habit resize');
            onEventChange(habitId, { start: startStr, end: endStr, timingIndex });
          }
        }}
        events={events}
        height={600}
      />
    </section>
  );
}