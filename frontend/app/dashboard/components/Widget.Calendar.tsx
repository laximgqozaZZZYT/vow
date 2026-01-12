"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Goal, Habit } from '../types';

interface CalendarWidgetProps {
  habits: Habit[];
  goals: Goal[];
  onEventClick?: (id: string) => void;
  onSlotSelect?: (isoDate: string, time?: string, endTime?: string) => void;
  onEventChange?: (id: string, updated: { start?: string; end?: string; timingIndex?: number }) => void;
  onRecurringAttempt?: (habitId: string, updated: { start?: string; end?: string; timingIndex?: number }) => void;
  onRecurringHabitRequest?: (habitId: string, updated: { start?: string; end?: string; timingIndex?: number }) => void;
}

export default function CalendarWidget({ 
  habits, 
  goals, 
  onEventClick, 
  onSlotSelect, 
  onEventChange, 
  onRecurringAttempt,
  onRecurringHabitRequest
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
    
    if (!g?.dueDate) {
      console.log('[Calendar] getGoalDueDate: No dueDate found', { goalId, goal: g });
      return undefined;
    }
    
    let result: Date | undefined;
    
    try {
      if (g.dueDate instanceof Date) {
        result = isNaN(g.dueDate.getTime()) ? undefined : g.dueDate;
      } else {
        // Try to parse string dueDate
        const dueDateStr = String(g.dueDate).trim();
        if (!dueDateStr || dueDateStr === 'null' || dueDateStr === 'undefined') {
          result = undefined;
        } else {
          result = parseYmd(dueDateStr);
        }
      }
    } catch (error) {
      console.error('[Calendar] Error parsing goal dueDate:', error, { goalId, dueDate: g.dueDate });
      result = undefined;
    }
    
    // Safe logging - check if result is a valid Date before calling toISOString
    const parsedDateStr = result && !isNaN(result.getTime()) ? result.toISOString().slice(0, 10) : 'Invalid Date';
    console.log('[Calendar] getGoalDueDate:', { 
      goalId, 
      goal: g, 
      dueDate: g?.dueDate, 
      dueDateType: typeof g?.dueDate,
      dueDateString: String(g?.dueDate), 
      parsed: parsedDateStr,
      isValidDate: result && !isNaN(result.getTime())
    });
    
    // Return undefined if the parsed date is invalid
    return result && !isNaN(result.getTime()) ? result : undefined;
  }

  function computeExpandDays(base: Date, goalDue?: Date): number {
    // Validate input dates
    if (!base || isNaN(base.getTime())) {
      console.error('[Calendar] Invalid base date in computeExpandDays:', base);
      base = new Date(); // Fallback to today
    }
    
    if (goalDue && isNaN(goalDue.getTime())) {
      console.error('[Calendar] Invalid goalDue date in computeExpandDays:', goalDue);
      goalDue = undefined; // Ignore invalid goal due date
    }
    
    // For Daily habits, always show events from today onwards, regardless of goal due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use the later of base date or today as the actual start
    const actualBase = new Date(Math.max(base.getTime(), today.getTime()));
    
    const horizon = goalDue ?? addDays(actualBase, INDEFINITE_HORIZON_DAYS);
    const endDay = new Date(horizon);
    endDay.setHours(0, 0, 0, 0);
    const baseDay = new Date(actualBase);
    baseDay.setHours(0, 0, 0, 0);
    
    // If goal due date is in the past, extend to at least 30 days from today
    const minHorizon = addDays(today, 30);
    const finalHorizon = goalDue && endDay < minHorizon ? minHorizon : endDay;
    
    const days = Math.ceil((finalHorizon.getTime() - baseDay.getTime()) / (24 * 3600 * 1000));
    const result = Math.max(1, days + 1);
    
    console.log('[Calendar] computeExpandDays:', { 
      originalBase: base.toISOString().slice(0, 10),
      actualBase: baseDay.toISOString().slice(0, 10), 
      goalDue: goalDue?.toISOString().slice(0, 10), 
      finalHorizon: finalHorizon.toISOString().slice(0, 10), 
      days, 
      result 
    });
    
    return result;
  }

  // Dynamically load FullCalendar and plugins on the client to avoid bundling
  // heavy libraries into the initial payload (benefits mobile cold-start).
  const [FCModules, setFCModules] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [FullCalendarMod, timeGridMod, interactionMod, dayGridMod, rruleMod] = await Promise.all([
          import('@fullcalendar/react'),
          import('@fullcalendar/timegrid'),
          import('@fullcalendar/interaction'),
          import('@fullcalendar/daygrid'),
          import('@fullcalendar/rrule'),
        ]);
        if (!mounted) return;
        setFCModules({
          FullCalendar: FullCalendarMod && (FullCalendarMod.default ?? FullCalendarMod),
          timeGrid: timeGridMod && (timeGridMod.default ?? timeGridMod),
          interaction: interactionMod && (interactionMod.default ?? interactionMod),
          dayGrid: dayGridMod && (dayGridMod.default ?? dayGridMod),
          rrule: rruleMod && (rruleMod.default ?? rruleMod),
        });
      } catch (e) {
        // Non-fatal: if dynamic import fails, keep the UI functional (no calendar)
        console.error('Failed to load FullCalendar modules', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const calendarRef = useRef<any>(null);
  const [navSelection, setNavSelection] = useState<'today' | 'tomorrow' | 'week' | 'month'>('today');
  
  // Mobile touch interaction states
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchMoveMode, setTouchMoveMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    eventId: string;
    habitId: string;
    eventTitle: string;
  } | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setSelectedEventId(null);
      setTouchMoveMode(false);
    };
    
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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

  // Handle mobile event selection and context menu
  const handleMobileEventClick = (clickInfo: any, event: any) => {
    if (!isMobile) return false;
    
    // Completely disable tooltip display to prevent interference with drag & drop
    return false;
  };

  // Handle long press for context menu
  const handleLongPress = (clickInfo: any, event: any) => {
    // Completely disable long press tooltips to prevent interference with drag & drop
    return;
  };

  // Handle mobile slot selection for moving events
  const handleMobileSlotSelect = (selectionInfo: any) => {
    if (!isMobile || !selectedEventId || !touchMoveMode) return;
    
    const cal = calendarRef.current?.getApi?.();
    if (!cal) return;
    
    const selectedEvent = cal.getEventById(selectedEventId);
    if (!selectedEvent) return;
    
    const ext = (selectedEvent as any).extendedProps ?? {};
    const habitId = ext.habitId ?? selectedEventId;
    const timingIndex = ext.timingIndex;
    
    // Calculate new start and end times
    const newStart = selectionInfo.start;
    const originalDuration = selectedEvent.end 
      ? selectedEvent.end.getTime() - selectedEvent.start.getTime()
      : 60 * 60 * 1000; // Default 1 hour
    
    const newEnd = new Date(newStart.getTime() + originalDuration);
    
    const startStr = newStart.toISOString();
    const endStr = newEnd.toISOString();
    
    // Update the event position in FullCalendar immediately (optimistic update)
    selectedEvent.setStart(newStart);
    selectedEvent.setEnd(newEnd);
    
    // Check if recurring and handle accordingly
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      const timings = (habit as any).timings ?? [];
      let isRecurring = false;
      
      if (typeof timingIndex === 'number' && timings[timingIndex]) {
        const timing = timings[timingIndex];
        isRecurring = timing.type === 'Daily' || timing.type === 'Weekly' || timing.type === 'Monthly';
      } else {
        const hasRecurringTimings = timings.some((t: any) => 
          t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly'
        );
        const hasRepeat = habit.repeat && habit.repeat !== 'Does not repeat';
        isRecurring = hasRecurringTimings || hasRepeat;
      }
      
      if (isRecurring && onRecurringHabitRequest) {
        onRecurringHabitRequest(habitId, { start: startStr, end: endStr, timingIndex });
      } else if (onEventChange) {
        onEventChange(habitId, { start: startStr, end: endStr, timingIndex });
      }
    }
    
    // Reset mobile interaction state
    setSelectedEventId(null);
    setTouchMoveMode(false);
    setContextMenu(null);
  };

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
      if (!h.active) {
        continue;
      }

      if (h.type === 'avoid') {
        continue;
      }
      
      const timings = (h as any).timings ?? [];
      const outdates = (h as any).outdates ?? [];
      
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
                  if (weekdays && !weekdays.includes(day.getDay())) {
                    continue;
                  }
                }
                
                if (t.type === 'Monthly') {
                  const ref = parseYmd(t.date);
                  if (ref && ref.getDate() !== day.getDate()) {
                    continue;
                  }
                }
                
                // Check if this specific date/time is excluded by outdates
                const isExcluded = outdates.some((outdate: any) => {
                  if (outdate.date !== dateS) return false;
                  
                  // Skip empty outdates (default entries with no meaningful exclusion data)
                  if (!outdate.start && !outdate.end && outdate.type === t.type) {
                    return false; // Don't exclude based on empty default outdate entries
                  }
                  
                  // If outdate has specific time, check if it matches this timing
                  if (outdate.start && outdate.end) {
                    const matches = outdate.start === t.start && outdate.end === t.end;
                    return matches;
                  }
                  
                  // If outdate has only start time, check if it matches
                  if (outdate.start) {
                    const matches = outdate.start === t.start;
                    return matches;
                  }
                  
                  // If outdate has no time specified, exclude the entire date
                  return true;
                });
                
                if (isExcluded) {
                  continue;
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
              // All-day recurring events - also need to check outdates
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
                
                // Check if this specific date is excluded by outdates
                const isExcluded = outdates.some((outdate: any) => {
                  if (outdate.date !== dateS) return false;
                  
                  // Skip empty outdates (default entries with no meaningful exclusion data)
                  if (!outdate.start && !outdate.end && outdate.type === t.type) {
                    return false; // Don't exclude based on empty default outdate entries
                  }
                  
                  return !outdate.start; // All-day exclusion
                });
                
                if (isExcluded) {
                  continue;
                }
                
                ev.push({ 
                  title: h.name, 
                  start: dateS, 
                  allDay: true, 
                  id: `${evIdBase}-${dateS}`, 
                  editable: true, 
                  className: 'vow-habit', 
                  extendedProps: { habitId: h.id, timingIndex: ti } 
                });
              }
            }
          }
        }
        continue;
      }

      const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10);
      
      // Check if this habit's date/time is excluded by outdates
      const isExcluded = outdates.some((outdate: any) => {
        if (outdate.date !== dateStr) return false;
        
        // Skip empty outdates (default entries with no meaningful exclusion data)
        if (!outdate.start && !outdate.end) {
          return false; // Don't exclude based on empty default outdate entries
        }
        
        // If habit has time and outdate has specific time, check if they match
        if ((h as any).time && outdate.start && outdate.end) {
          return outdate.start === (h as any).time && outdate.end === (h as any).endTime;
        }
        
        // If habit has time and outdate has only start time, check if it matches
        if ((h as any).time && outdate.start) {
          return outdate.start === (h as any).time;
        }
        
        // If outdate has no time specified, exclude the entire date
        if (!outdate.start) {
          return true;
        }
        
        return false;
      });
      
      if (isExcluded) {
        continue;
      }
      
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
    <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b] w-full overflow-hidden">
      <h2 className="mb-3 text-lg font-medium">Calendar</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
            className={`rounded px-2 sm:px-3 py-1 text-xs sm:text-sm ${navSelection === b ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-200'}`}
          >
            {b === 'today' ? 'today' : b === 'tomorrow' ? 'tomorrow' : b === 'week' ? 'week' : 'month'}
          </button>
        ))}
      </div>
      
      <div className="w-full overflow-x-auto">
        <div className="min-w-[300px]">
          <style jsx>{`
            .fc-event.selected-event {
              box-shadow: 0 0 0 2px #3b82f6 !important;
              z-index: 999 !important;
            }
            .fc-event.move-mode {
              opacity: 0.7 !important;
              animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.7; }
              50% { opacity: 0.4; }
            }
          `}</style>
      
      {FCModules && FCModules.FullCalendar ? (
        <FCModules.FullCalendar
          ref={calendarRef}
          plugins={[ FCModules.timeGrid, FCModules.dayGrid, FCModules.interaction, FCModules.rrule ]}
          initialView={navSelection === 'today' || navSelection === 'tomorrow' ? 'timeGridDay' : navSelection === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
          nowIndicator={true}
          height={600}
          aspectRatio={window.innerWidth < 768 ? 1.0 : 1.35}
          viewDidMount={() => {
            if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0);
          }}
          datesSet={() => {
            if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0);
          }}
          editable={true}
          eventStartEditable={!isMobile}
          eventDurationEditable={!isMobile}
          eventResizableFromStart={!isMobile}
          eventOverlap={true}
          eventClassNames={(arg: any) => {
            const classes: string[] = [];
            if (selectedEventId === arg.event.id) {
              classes.push('selected-event');
            }
            if (touchMoveMode && selectedEventId === arg.event.id) {
              classes.push('move-mode');
            }
            return classes;
          }}
          eventConstraint={{
            start: '00:00',
            end: '24:00'
          }}
          headerToolbar={{ 
            left: 'prev,next', 
            center: 'title', 
            right: '' 
          }}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          selectable={true}
          selectMirror={true}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dayHeaderFormat={window.innerWidth < 768 ? { weekday: 'short' } : { weekday: 'long' }}
          slotLabelInterval={window.innerWidth < 768 ? '02:00:00' : '01:00:00'}
          select={(selectionInfo: any) => {
          // Handle mobile event moving
          if (isMobile && touchMoveMode) {
            handleMobileSlotSelect(selectionInfo);
            return;
          }
          
          // Default slot selection behavior
          const iso = selectionInfo.startStr?.slice(0,10) ?? selectionInfo.start?.toISOString().slice(0,10);
          const startTime = selectionInfo.startStr && selectionInfo.startStr.length > 10 ? selectionInfo.startStr.slice(11,16) : undefined;
          const endSrc = (selectionInfo.endStr && selectionInfo.endStr.length > 10)
            ? selectionInfo.endStr
            : (selectionInfo.end ? selectionInfo.end.toISOString() : undefined);
          const endTime = endSrc && endSrc.length > 10 ? endSrc.slice(11,16) : undefined;
          if (onSlotSelect && iso) onSlotSelect(iso, startTime, endTime);
          }}
          eventClick={(clickInfo: any) => {
          // Handle mobile touch interactions
          if (isMobile) {
            const handled = handleMobileEventClick(clickInfo, clickInfo.jsEvent);
            if (handled) return;
          }
          
          // Default desktop behavior
          const id = clickInfo.event.id;
          const ext = (clickInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          if (onEventClick) onEventClick(habitId);
          }}
          eventDidMount={(info: any) => {
          // Completely disable touch event handling to prevent tooltip interference
          if (!isMobile) return;
          
          // No touch event listeners to prevent any tooltip display
          return () => {
            // No cleanup needed since no listeners are added
          };
          }}
          dateClick={(dateClickInfo: any) => {
          // Reset mobile selection when clicking empty space
          if (isMobile) {
            setSelectedEventId(null);
            setContextMenu(null);
            setTouchMoveMode(false);
          }
          
          const iso = dateClickInfo.dateStr?.slice(0,10) ?? dateClickInfo.date?.toISOString().slice(0,10);
          const time = dateClickInfo.dateStr && dateClickInfo.dateStr.length > 10 ? dateClickInfo.dateStr.slice(11,16) : undefined;
          if (onSlotSelect && iso) onSlotSelect(iso, time, undefined);
          }}
          eventDrop={(dropInfo: any) => {
          // Disable drag and drop on mobile - use touch interactions instead
          if (isMobile) {
            dropInfo.revert();
            return;
          }
          
          const id = dropInfo.event.id;
          const startStr = dropInfo.event.start ? dropInfo.event.start.toISOString() : undefined;
          const endStr = dropInfo.event.end ? dropInfo.event.end.toISOString() : undefined;
          const ext = (dropInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          const timingIndex = ext.timingIndex;
          
          const habit = habits.find(h => h.id === habitId);
          if (!habit) {
            return;
          }
          
          const timings = habit && (habit as any).timings && Array.isArray((habit as any).timings) ? (habit as any).timings : [];
          
          // Check if this specific event is editable
          let isEditable = true;
          let isRecurring = false;
          
          if (typeof timingIndex === 'number' && timings[timingIndex]) {
            // If timingIndex is specified, check the specific timing entry
            const timing = timings[timingIndex];
            
            // Date type timings are always editable (specific dates, not recurring)
            if (timing.type === 'Date') {
              isEditable = true;
              isRecurring = false;
            } else if (timing.type === 'Daily' || timing.type === 'Weekly' || timing.type === 'Monthly') {
              isEditable = true; // Allow editing but show confirmation
              isRecurring = true;
            }
          } else {
            // No timingIndex - check if habit has recurring patterns
            const hasRecurringTimings = timings.length > 0 && timings.some((t: any) => 
              t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly'
            );
            const hasRepeat = habit && habit.repeat && habit.repeat !== 'Does not repeat';
            isRecurring = hasRecurringTimings || hasRepeat;
            isEditable = true; // Allow editing but show confirmation for recurring
          }
          
          if (!isEditable) {
            try { dropInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr });
            return;
          }
          
          if (isRecurring) {
            if (onRecurringHabitRequest) {
              onRecurringHabitRequest(habitId, { start: startStr, end: endStr, timingIndex });
            }
            return;
          }
          
          if (onEventChange) {
            onEventChange(habitId, { start: startStr, end: endStr, timingIndex });
          }
          }}
          eventResize={(resizeInfo: any) => {
          // Disable resize on mobile - use touch interactions instead
          if (isMobile) {
            resizeInfo.revert();
            return;
          }
          
          const id = resizeInfo.event.id;
          const startStr = resizeInfo.event.start ? resizeInfo.event.start.toISOString() : undefined;
          const endStr = resizeInfo.event.end ? resizeInfo.event.end.toISOString() : undefined;
          const ext = (resizeInfo.event as any).extendedProps ?? {};
          const habitId = ext.habitId ?? id;
          const timingIndex = ext.timingIndex;
          
          const habit = habits.find(h => h.id === habitId);
          if (!habit) {
            return;
          }
          
          const timings = habit && (habit as any).timings && Array.isArray((habit as any).timings) ? (habit as any).timings : [];
          
          // Check if this specific event is editable
          let isEditable = true;
          let isRecurring = false;
          
          if (typeof timingIndex === 'number' && timings[timingIndex]) {
            // If timingIndex is specified, check the specific timing entry
            const timing = timings[timingIndex];
            
            // Date type timings are always editable (specific dates, not recurring)
            if (timing.type === 'Date') {
              isEditable = true;
              isRecurring = false;
            } else if (timing.type === 'Daily' || timing.type === 'Weekly' || timing.type === 'Monthly') {
              isEditable = true; // Allow editing but show confirmation
              isRecurring = true;
            }
          } else {
            // No timingIndex - check if habit has recurring patterns
            const hasRecurringTimings = timings.length > 0 && timings.some((t: any) => 
              t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly'
            );
            const hasRepeat = habit && habit.repeat && habit.repeat !== 'Does not repeat';
            isRecurring = hasRecurringTimings || hasRepeat;
            isEditable = true; // Allow editing but show confirmation for recurring
          }
          
          if (!isEditable) {
            try { resizeInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr });
            return;
          }
          
          if (isRecurring) {
            if (onRecurringHabitRequest) {
              onRecurringHabitRequest(habitId, { start: startStr, end: endStr, timingIndex });
            }
            return;
          }
          
          if (onEventChange) {
            onEventChange(habitId, { start: startStr, end: endStr, timingIndex });
          }
          }}
          events={events}
        />
      ) : (
        <div className="p-6 text-center text-sm text-gray-500">Loading calendar...</div>
      )}
        </div>
      </div>

      {/* Mobile Context Menu */}
      {contextMenu && contextMenu.show && (
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-2 min-w-[200px]"
          style={{
            left: Math.min(contextMenu.x - 100, window.innerWidth - 220),
            top: contextMenu.y - 10,
            transform: 'translateY(-100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {contextMenu.eventTitle}
            </p>
          </div>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              if (onEventClick) onEventClick(contextMenu.habitId);
              setContextMenu(null);
              setSelectedEventId(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            編集
          </button>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              setTouchMoveMode(true);
              setContextMenu(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            移動
          </button>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              setContextMenu(null);
              setSelectedEventId(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            キャンセル
          </button>
        </div>
      )}

      {/* Mobile Move Mode Indicator */}
      {touchMoveMode && selectedEventId && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span className="text-sm font-medium">移動先をタップしてください</span>
          <button
            onClick={() => {
              setTouchMoveMode(false);
              setSelectedEventId(null);
            }}
            className="ml-2 text-white hover:text-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile Instructions */}
      {isMobile && !contextMenu && !touchMoveMode && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          イベントをタップして選択 → もう一度タップでメニュー表示
        </div>
      )}
    </section>
  );
}