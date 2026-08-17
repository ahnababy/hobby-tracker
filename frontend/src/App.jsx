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
  RefreshCw,
  LogOut,
  UserCheck,
  Clock
} from 'lucide-react';
import AuthModal from './components/AuthModal';

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
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// Helper: Add days to date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper: Format last login date for display
function formatLastLogin(isoString) {
  if (!isoString) return 'First session';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default function App() {
  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getStartOfWeek(new Date()));
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justToggledCell, setJustToggledCell] = useState(null);

  const todayStr = useMemo(() => formatDate(new Date()), []);

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

  // Handle successful authentication
  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  // Logout handler
  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setToken('');
    setUser(null);
    setHabits([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Fetch habits for authenticated user
  const loadHabits = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/habits/?start_date=${startDateStr}&end_date=${endDateStr}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
      }
    } catch (err) {
      console.error('Error fetching habits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadHabits();
    }
  }, [token, startDateStr, endDateStr]);

  const handlePrevWeek = () => setCurrentWeekMonday((prev) => addDays(prev, -7));
  const handleNextWeek = () => setCurrentWeekMonday((prev) => addDays(prev, 7));
  const handleToday = () => setCurrentWeekMonday(getStartOfWeek(new Date()));

  // Toggle log status via API
  const handleToggleLog = async (habitId, dateStr) => {
    if (!token) return;
    const cellKey = `${habitId}-${dateStr}`;
    setJustToggledCell(cellKey);
    setTimeout(() => setJustToggledCell(null), 300);

    // Optimistic local update
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ habit_id: habitId, date: dateStr }),
      });

      if (!response.ok) {
        loadHabits();
      } else {
        const updatedLog = await response.json();
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

  // Add habit
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim() || !token) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/habits/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
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
    if (!window.confirm(`Delete habit "${name}"?`)) return;

    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    try {
      await fetch(`${API_BASE_URL}/habits/${habitId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${token}`
        }
      });
    } catch (err) {
      console.error('Error deleting habit:', err);
      loadHabits();
    }
  };

  const isHabitDone = (habit, dateStr) => {
    const log = habit.logs.find((l) => l.date === dateStr);
    return log ? log.is_done : false;
  };

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

  // Show Auth Modal if not authenticated
  if (!token) {
    return <AuthModal onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      
      {/* TOP USER PROFILE & HEADER BAR */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
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
            Welcome back, <strong style={{ color: '#818cf8' }}>{user?.username}</strong>!
          </p>
        </div>

        {/* Right Header Controls: Last Login Memory & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* User Badge & Last Login Memory */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
              <UserCheck size={16} />
              {user?.username}
            </div>
            
            <div style={{ height: '16px', width: '1px', background: 'var(--border-color)' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem' }} title="Memory of Last Login">
              <Clock size={14} color="#818cf8" />
              <span>Last login: <strong style={{ color: '#e2e8f0' }}>{formatLastLogin(user?.last_login)}</strong></span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '6px'
              }}
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>

          {/* Week Navigation */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <button 
              onClick={handlePrevWeek} 
              title="Previous Week"
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}
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
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {user?.username}'s Habit Dashboard
          </h2>
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
                    No habits found for {user?.username}. Add your first habit below!
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
              outline: 'none'
            }}
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
