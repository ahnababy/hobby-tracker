import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Flame, 
  Award, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Helper: Format Date object to YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Get Monday of the week for a given date
function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(date.setDate(diff));
}

// Helper: Add days to date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default function App() {
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getStartOfWeek(new Date()));
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justToggledCell, setJustToggledCell] = useState(null); // 'habitId-dateStr'

  const todayStr = useMemo(() => formatDate(new Date()), []);

  // Compute 7 days of current week (Monday -> Sunday)
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentWeekMonday, i);
      days.push({
        dateObj: d,
        dateStr: formatDate(d),
        dayName: dayNames[i],
        formattedShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: formatDate(d) === todayStr,
      });
    }
    return days;
  }, [currentWeekMonday, todayStr]);

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  // Fetch habits and logs for date range
  const loadHabits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/habits/?start_date=${startDateStr}&end_date=${endDateStr}`);
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
      } else {
        console.error('Failed to fetch habits');
      }
    } catch (err) {
      console.error('Error connecting to backend API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHabits();
  }, [startDateStr, endDateStr]);

  // Week Navigation handlers
  const handlePrevWeek = () => {
    setCurrentWeekMonday((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekMonday((prev) => addDays(prev, 7));
  };

  const handleToday = () => {
    setCurrentWeekMonday(getStartOfWeek(new Date()));
  };

  // Toggle log status via API
  const handleToggleLog = async (habitId, dateStr) => {
    const cellKey = `${habitId}-${dateStr}`;
    setJustToggledCell(cellKey);
    setTimeout(() => setJustToggledCell(null), 300);

    // Optimistic UI Update
    setHabits((prevHabits) =>
      prevHabits.map((habit) => {
        if (habit.id !== habitId) return habit;
        const existingLogIndex = habit.logs.findIndex((l) => l.date === dateStr);
        let newLogs = [...habit.logs];
        if (existingLogIndex >= 0) {
          newLogs[existingLogIndex] = {
            ...newLogs[existingLogIndex],
            is_done: !newLogs[existingLogIndex].is_done,
          };
        } else {
          newLogs.push({ habit_fk: habitId, date: dateStr, is_done: true });
        }
        return { ...habit, logs: newLogs };
      })
    );

    try {
      const response = await fetch(`${API_BASE_URL}/habits/toggle-log/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: habitId, date: dateStr }),
      });

      if (!response.ok) {
        // Revert on error
        loadHabits();
      } else {
        const updatedLog = await response.json();
        // Sync with API response
        setHabits((prevHabits) =>
          prevHabits.map((h) => {
            if (h.id !== habitId) return h;
            const filteredLogs = h.logs.filter((l) => l.date !== dateStr);
            return { ...h, logs: [...filteredLogs, updatedLog] };
          })
        );
      }
    } catch (error) {
      console.error('Failed to toggle habit log:', error);
      loadHabits();
    }
  };

  // Add new habit
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/habits/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim() }),
      });

      if (response.ok) {
        setNewHabitName('');
        await loadHabits();
      }
    } catch (err) {
      console.error('Error creating habit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete habit
  const handleDeleteHabit = async (habitId, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    // Optimistic removal
    setHabits((prev) => prev.filter((h) => h.id !== habitId));

    try {
      await fetch(`${API_BASE_URL}/habits/${habitId}/`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting habit:', err);
      loadHabits();
    }
  };

  // Helper check if habit is done on date
  const isHabitDone = (habit, dateStr) => {
    const log = habit.logs.find((l) => l.date === dateStr);
    return log ? log.is_done : false;
  };

  // Summary Metrics calculations
  const stats = useMemo(() => {
    if (habits.length === 0) return { todayPct: 0, totalHabits: 0, bestStreak: 0, weeklyDoneCount: 0 };

    let todayDoneCount = 0;
    let weeklyDoneCount = 0;
    let maxStreak = 0;

    habits.forEach((habit) => {
      if (isHabitDone(habit, todayStr)) todayDoneCount++;
      if (habit.streak > maxStreak) maxStreak = habit.streak;

      weekDays.forEach((day) => {
        if (isHabitDone(habit, day.dateStr)) weeklyDoneCount++;
      });
    });

    const todayPct = Math.round((todayDoneCount / habits.length) * 100);
    return {
      todayPct,
      todayDoneCount,
      totalHabits: habits.length,
      bestStreak: maxStreak,
      weeklyDoneCount,
    };
  }, [habits, todayStr, weekDays]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      
      {/* HEADER BAR */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #10b981)', padding: '10px', borderRadius: '14px', display: 'flex' }}>
              <CheckCircle2 size={28} color="#fff" />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(90deg, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HabitTracker
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Build consistency, one checkmark at a time.
          </p>
        </div>

        {/* WEEK NAVIGATION */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
          <button 
            onClick={handlePrevWeek} 
            title="Previous Week"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronLeft size={20} />
          </button>

          <button 
            onClick={handleToday}
            style={{ 
              background: 'rgba(99, 102, 241, 0.2)', 
              border: '1px solid rgba(99, 102, 241, 0.4)', 
              color: '#818cf8', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={14} />
            Today
          </button>

          <span style={{ fontSize: '0.9rem', fontWeight: 600, padding: '0 8px', color: '#e2e8f0' }}>
            {weekDays[0].formattedShort} – {weekDays[6].formattedShort}
          </span>

          <button 
            onClick={handleNextWeek}
            title="Next Week"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* STATS OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Card 1: Today's Progress */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Today's Completion
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
              {stats.todayPct}%
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>
                ({stats.todayDoneCount}/{stats.totalHabits})
              </span>
            </div>
            <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
              <div className="progress-bar-fill" style={{ width: `${stats.todayPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 2: Active Habits */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Habits
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
              {stats.totalHabits}
            </div>
          </div>
        </div>

        {/* Card 3: Best Streak */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Flame size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Best Streak
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {stats.bestStreak} <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 600 }}>Days 🔥</span>
            </div>
          </div>
        </div>

        {/* Card 4: Weekly Completions */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Weekly Check-offs
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
              {stats.weeklyDoneCount}
            </div>
          </div>
        </div>

      </div>

      {/* MAIN HABITS GRID TABLE */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: '10px 0' }}>
        
        {/* Table Header Controls */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Habits Tracker</h2>
          <button 
            onClick={loadHabits}
            title="Refresh API Data"
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Habit Table Container */}
        <div style={{ overflowX: 'auto' }}>
          <table className="habit-table">
            <thead>
              <tr>
                <th className="habit-col" style={{ width: '30%' }}>Habit Name</th>
                {weekDays.map((day) => (
                  <th 
                    key={day.dateStr} 
                    className={day.isToday ? 'today-header' : ''}
                    style={{ width: '9%' }}
                  >
                    <div>{day.dayName}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>
                      {day.formattedShort}
                    </div>
                  </th>
                ))}
                <th style={{ width: '10%' }}>Streak</th>
                <th style={{ width: '7%' }}></th>
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No habits found. Add a habit below to get started!
                  </td>
                </tr>
              ) : (
                habits.map((habit) => (
                  <tr key={habit.id}>
                    {/* Habit Name Column */}
                    <td className="habit-col">
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>
                        {habit.name}
                      </div>
                    </td>

                    {/* Day Cells (Monday -> Sunday) */}
                    {weekDays.map((day) => {
                      const done = isHabitDone(habit, day.dateStr);
                      const isJustToggled = justToggledCell === `${habit.id}-${day.dateStr}`;

                      return (
                        <td key={day.dateStr} className={day.isToday ? 'today-cell' : ''}>
                          <button
                            onClick={() => handleToggleLog(habit.id, day.dateStr)}
                            className={`check-btn ${done ? 'completed' : ''} ${isJustToggled ? 'just-toggled' : ''}`}
                            title={`${habit.name} - ${day.dayName} (${day.dateStr}): ${done ? 'Completed' : 'Click to complete'}`}
                          >
                            {done && <Check size={20} strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}

                    {/* Streak Column */}
                    <td>
                      {habit.streak > 0 ? (
                        <span className="badge badge-streak">
                          <Flame size={12} /> {habit.streak}d
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* Delete Action */}
                    <td>
                      <button
                        onClick={() => handleDeleteHabit(habit.id, habit.name)}
                        title="Delete Habit"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          transition: 'color 0.2s, background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#94a3b8';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* QUICK ADD HABIT FORM */}
        <form onSubmit={handleAddHabit} style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Add new habit (e.g., Drank Water, Read 10 pages)..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            disabled={isSubmitting}
            style={{
              flex: 1,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px 16px',
              color: '#fff',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newHabitName.trim()}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: isSubmitting || !newHabitName.trim() ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !newHabitName.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Plus size={18} />
            Add Habit
          </button>
        </form>

      </div>

    </div>
  );
}
