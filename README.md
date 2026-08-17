# Habit Tracker 🎯

A modern full-stack daily habit tracking application built with **Django REST Framework** for the backend API and **React (Vite)** for an interactive weekly grid UI.

![Habit Tracker Interface](https://raw.githubusercontent.com/ahnababy/hobby-tracker/main/preview.png)

## Features

- **Daily Check-Off Grid**: Rows are habits and columns represent days of the week (Monday – Sunday).
- **Week Navigation**: Toggle between previous/next weeks or leap back to Today.
- **Django REST API**:
  - `Habit` (name, owner, created_at)
  - `HabitLog` (habit_fk, date, is_done)
  - Toggle endpoint (`POST /api/habits/toggle-log/`)
  - Range filter (`GET /api/habits/?start_date=...&end_date=...`)
- **Real-Time Progress & Metrics**:
  - Today's Completion Rate (%)
  - Consecutive Days Streak calculation 🔥
  - Active Habits counter
- **Sleek UI/UX**: Dark mode glassmorphism theme, smooth animations, and responsive layout.

---

## Project Structure

```
├── backend/            # Django REST API project
│   ├── backend/        # Project settings & root URLs
│   ├── tracker/        # Habit & HabitLog models, views, serializers
│   └── manage.py
├── frontend/           # React + Vite frontend application
│   ├── src/            # App.jsx, index.css
│   └── package.json
└── README.md
```

---

## Quick Start

### 1. Backend Setup (Django)

```bash
cd backend
python -m pip install django djangorestframework django-cors-headers
python manage.py migrate
python manage.py seed_habits
python manage.py runserver 8000
```

The REST API will run on `http://127.0.0.1:8000/api/`.

### 2. Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

The React app will run on `http://localhost:5173/`.

---

## API Endpoints

- `GET /api/habits/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - List habits & logs for range
- `POST /api/habits/` - Create a habit
- `DELETE /api/habits/{id}/` - Delete a habit
- `POST /api/habits/toggle-log/` - Toggle log completion status `{ habit_id, date }`
