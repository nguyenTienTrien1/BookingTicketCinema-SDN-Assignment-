# BookingCinemaTicket

Starter project for a cinema ticket booking application using React, Express and MongoDB.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A running MongoDB instance (local or hosted)

## Setup

1. Run `npm install` from the project root.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`.
3. Open two terminals at the project root:
   - `npm run dev:backend`
   - `npm run dev:frontend`
4. Open `http://localhost:5173`.

The frontend calls `/api/health` through Vite's proxy. The backend listens on port 5000 by default. The database connection starts when the backend starts.

## Structure

- `frontend/src/components` - reusable UI components
- `frontend/src/pages` - page components
- `frontend/src/assets` - images, fonts and icons
- `frontend/src/services` - API client functions
- `frontend/src/routes` - frontend routing
- `frontend/src/hooks`, `contexts`, `layouts`, `utils` - shared frontend code
- `backend/src/controllers` - HTTP request handlers
- `backend/src/services` - business logic
- `backend/src/models` - Mongoose models
- `backend/src/routes` - API routes
- `backend/src/middleware`, `validators`, `utils` - shared backend code

Empty folders contain `.gitkeep` so Git can track them until real files are added.
