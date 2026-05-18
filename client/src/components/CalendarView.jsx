import { useState, useMemo } from 'react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_COLORS = {
  none: '#6366f1',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  // Next month padding (fill to 6 rows = 42 cells)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
  }
  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function CalendarView({ cards = [], onCardClick }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const cardsWithDate = cards.filter(c => c.due_date);
  const cardsWithoutDate = cards.filter(c => !c.due_date);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayDate = new Date();

  return (
    <div className="flex gap-4">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {calendarDays.map(({ day, currentMonth, date }, idx) => {
            const isToday = isSameDay(date, todayDate);
            const dayCards = cardsWithDate.filter(c => {
              const due = new Date(c.due_date);
              return isSameDay(due, date);
            });

            return (
              <div
                key={idx}
                className={`border-r border-b border-slate-200 dark:border-slate-700 p-1 min-h-[80px] ${
                  currentMonth ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'
                }`}
              >
                <div className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                  isToday
                    ? 'bg-indigo-600 text-white'
                    : currentMonth
                    ? 'text-slate-600 dark:text-slate-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayCards.slice(0, 3).map(card => (
                    <button
                      key={card.id}
                      onClick={() => onCardClick?.(card)}
                      className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                      style={{
                        background: (PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.none) + '20',
                        color: PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.none,
                      }}
                      title={card.title}
                    >
                      {card.title}
                    </button>
                  ))}
                  {dayCards.length > 3 && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{dayCards.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* No-date sidebar */}
      {cardsWithoutDate.length > 0 && (
        <div className="w-52 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">No due date</p>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {cardsWithoutDate.map(card => (
              <button
                key={card.id}
                onClick={() => onCardClick?.(card)}
                className="w-full text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{card.title}</p>
                {card.priority && card.priority !== 'none' && (
                  <span
                    className="text-[10px] mt-1 inline-block"
                    style={{ color: PRIORITY_COLORS[card.priority] }}
                  >
                    {card.priority}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
