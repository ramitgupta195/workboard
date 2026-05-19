# Workboard

A full-stack project management tool built with React and Node.js. Drag-and-drop Kanban boards with real-time collaboration, automation rules, role-based permissions, and team notifications.

**Live:** [workboard-nu.vercel.app](https://workboard-nu.vercel.app) · **API:** [workboard-y9uh.onrender.com](https://workboard-y9uh.onrender.com)

---

## Features

- **Kanban boards** — Drag-and-drop cards across columns with WIP limits
- **Card details** — Description, priority, due dates, labels, checklists, file attachments, @mention comments
- **Multiple views** — Board, List, and Calendar view per board
- **Real-time sync** — Socket.io pushes card moves, updates, and assignments instantly to all connected users
- **Automation rules** — Trigger-based automations (card moved, priority changed, due date passed, card idle)
- **Role-based access** — Owner / Admin / Member / Viewer roles with granular permission editing per board
- **Team invites** — Email invite links with role assignment; auto-accept on login/register
- **Notifications** — In-app + email (via Gmail REST API) for assignments, mentions, card moves, role changes
- **My Tasks** — Personal view of all cards assigned to you across every board, with real-time updates
- **Search** — Full-text search across cards by title
- **Google OAuth** — Sign in with Google alongside email/password auth
- **Dark mode** — System-aware theme toggle
- **CSV export** — Export any board's cards to CSV

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Vite, Tailwind CSS |
| State | Zustand |
| Drag & Drop | @dnd-kit |
| Real-time | Socket.io |
| HTTP client | Axios |
| Backend | Express.js, Node.js 20 |
| Database | PostgreSQL (prod), local pg-compatible pool |
| Auth | JWT, Passport.js, Google OAuth 2.0 |
| Email | Gmail REST API via googleapis |
| File uploads | Multer |
| Deployment | Vercel (frontend) + Render (backend) + Neon (database) |

---

## Project Structure

```
workboard/
├── client/                    # React frontend
│   ├── src/
│   │   ├── api/index.js       # Axios API client
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # useSocket, useBoardPermissions
│   │   ├── pages/             # Page-level components
│   │   └── store/             # Zustand stores (auth, theme)
│   ├── vercel.json            # SPA rewrite rule for Vercel
│   └── vite.config.js
│
├── server/                    # Express backend
│   ├── db/
│   │   ├── database.js        # pg connection pool + query helpers
│   │   └── schema.js          # PostgreSQL DDL (auto-runs on startup)
│   ├── engine/
│   │   └── automations.js     # Automation trigger & action execution
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   └── boardPermission.js # Role-based route guards
│   ├── routes/                # Express route handlers
│   ├── utils/
│   │   ├── email.js           # Gmail REST API email sender
│   │   └── notify.js          # Create notifications + emit socket events
│   ├── io.js                  # Socket.io instance singleton
│   └── index.js               # Server entry point
│
├── render.yaml                # Render.com deployment config
├── .nvmrc                     # Node 20.19.0
└── package.json               # Root dev scripts (concurrently)
```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or use a free [Neon](https://neon.tech) database)

### 1. Clone and install

```bash
git clone https://github.com/ramitgupta195/workboard.git
cd workboard
npm run install:all
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/workboard

# Auth
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# Google OAuth (optional — for "Sign in with Google")
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Gmail notifications (optional — for email notifications)
GMAIL_USER=you@gmail.com
GMAIL_REFRESH_TOKEN=
GOOGLE_CLIENT_ID=        # same as above if using OAuth for gmail

# Frontend URL (used in email links and CORS)
CLIENT_URL=http://localhost:5173
```

The database schema is created automatically when the server starts.

### 3. Run

```bash
npm run dev
```

This runs both the frontend (port 5173) and backend (port 3001) concurrently.

---

## Environment Variables

### Server (required)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `SESSION_SECRET` | Secret for express-session |
| `CLIENT_URL` | Frontend URL (used for CORS and email links) |

### Server (optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (e.g. `https://your-api.com/api/auth/google/callback`) |
| `GMAIL_USER` | Gmail address to send notifications from |
| `GMAIL_REFRESH_TOKEN` | OAuth refresh token for Gmail REST API |
| `ADMIN_KEY` | Key for admin-only endpoints |
| `PORT` | HTTP port (default: 3001) |

### Client (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (e.g. `https://your-api.onrender.com`) |

> **Important:** `VITE_API_URL` is baked into the Vite bundle at build time. Set it in your Vercel project settings under Environment Variables _before_ deploying, then trigger a redeploy.

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repo
3. Set:
   - **Build command:** `cd server && npm install`
   - **Start command:** `node server/index.js`
   - **Health check path:** `/api/health`
4. Add all required environment variables in Render's dashboard
5. A `render.yaml` is included for automatic configuration

### Database → Neon

1. Create a free PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy the connection string into `DATABASE_URL`
3. The schema initializes automatically on first server start

### Frontend → Vercel

1. Import the repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `client`
3. Set `VITE_API_URL` to your Render backend URL
4. Deploy — `vercel.json` handles the SPA rewrite

### Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback` (dev)
   - `https://your-api.onrender.com/api/auth/google/callback` (prod)
4. Add the client ID/secret to your environment

### Gmail notifications setup

Workboard sends emails via the Gmail REST API (not SMTP) to work around Render's blocked outbound ports.

1. In Google Cloud Console, enable the **Gmail API**
2. Use the same OAuth Client ID as above
3. Get a refresh token via OAuth Playground or a one-time script, with scope `https://mail.google.com/`
4. Set `GMAIL_USER`, `GMAIL_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register with email + password |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/google` | — | Start Google OAuth flow |
| GET | `/auth/google/callback` | — | OAuth redirect handler |
| GET | `/auth/me` | JWT | Get current user |
| PUT | `/auth/profile` | JWT | Update name / avatar |
| PUT | `/auth/change-password` | JWT | Change password |
| POST | `/auth/forgot-password` | — | Send reset email |
| POST | `/auth/reset-password` | — | Reset password with token |

### Boards

| Method | Path | Description |
|--------|------|-------------|
| GET | `/boards` | List user's boards |
| POST | `/boards` | Create board |
| GET | `/boards/:id` | Get board with columns + cards |
| PUT | `/boards/:id` | Update title/description/background |
| DELETE | `/boards/:id` | Delete board |
| POST | `/boards/:id/members` | Add member by email |
| PUT | `/boards/:id/members/:userId` | Change member role |
| DELETE | `/boards/:id/members/:userId` | Remove member |
| POST | `/boards/:id/columns` | Add column |
| POST | `/boards/:id/columns/reorder` | Reorder columns |
| GET | `/boards/:id/permissions` | Get role permissions |
| PUT | `/boards/:id/permissions/:role` | Update role permissions |
| GET | `/boards/:id/export` | Download CSV export |
| GET | `/boards/:id/archived` | List archived cards |
| POST | `/boards/:id/invites` | Create invite link |

### Cards

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cards/columns/:columnId/cards` | Create card |
| GET | `/cards/:id` | Get card detail |
| PUT | `/cards/:id` | Update card (title, description, priority, due date, assignees, labels) |
| DELETE | `/cards/:id` | Delete card |
| POST | `/cards/move` | Move card to column |
| GET | `/cards/:id/comments` | List comments |
| POST | `/cards/:id/comments` | Add comment (supports @mentions) |
| GET | `/cards/:id/activities` | Activity log |
| PUT | `/cards/:id/archive` | Archive card |
| PUT | `/cards/:id/unarchive` | Unarchive card |
| GET | `/cards/:id/attachments` | List attachments |
| POST | `/cards/:id/attachments` | Upload file |
| DELETE | `/cards/attachments/:id` | Delete attachment |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/my-tasks` | Cards assigned to current user |
| GET | `/notifications` | User notifications |
| PUT | `/notifications/:id/read` | Mark notification read |
| PUT | `/notifications/read-all` | Mark all read |
| GET | `/search?q=` | Search cards |
| GET | `/checklists/cards/:cardId/checklists` | Card checklists |
| GET | `/automations/boards/:boardId` | Board automation rules |
| POST | `/automations/boards/:boardId` | Create automation rule |
| GET | `/invites/:token` | Get invite info |
| POST | `/invites/:token/accept` | Accept invite (requires auth) |

---

## Automation Rules

Automation rules are configured per board and run automatically.

### Trigger types

| Trigger | When it fires |
|---------|---------------|
| `card_moved` | Card is moved to a specific column |
| `card_created` | A new card is created in a column |
| `priority_changed` | Card priority changes to a specific value |
| `due_date_passed` | Scheduled daily — fires for cards past their due date |
| `card_idle` | Scheduled daily — fires for cards with no activity in N days |

### Action types

| Action | What it does |
|--------|-------------|
| `assign_user` | Assign a user to the card |
| `set_due_date` | Set due date N days from now |
| `add_label` | Add a label to the card |
| `move_to_column` | Move the card to a specific column |
| `set_priority` | Set the card's priority |
| `create_card_in_board` | Create a new card in a column |

---

## Role Permissions

Each board has four roles: **Owner**, **Admin**, **Member**, **Viewer**. Permissions per role can be customized from the board's Permissions page.

| Permission | Default: Owner | Admin | Member | Viewer |
|-----------|---------------|-------|--------|--------|
| `create_card` | ✓ | ✓ | ✓ | — |
| `edit_card` | ✓ | ✓ | ✓ | — |
| `delete_card` | ✓ | ✓ | — | — |
| `move_card` | ✓ | ✓ | ✓ | — |
| `manage_members` | ✓ | ✓ | — | — |
| `manage_columns` | ✓ | ✓ | — | — |
| `manage_automations` | ✓ | ✓ | — | — |

---

## Real-time Events

Socket.io events broadcast to board rooms (`board:{id}`) and user rooms (`user:{id}`):

| Event | Room | Payload |
|-------|------|---------|
| `card:created` | board | Full card object |
| `card:updated` | board | Full card object with assignees + labels |
| `card:deleted` | board | `{ cardId, columnId, boardId }` |
| `card:moved` | board | `{ cardId, destColumnId, columnOrders }` |
| `column:created` | board | Column object |
| `column:updated` | board | Column object |
| `column:deleted` | board | `{ columnId }` |
| `tasks:updated` | user | (no payload — triggers refetch) |

---

## Admin Endpoints

These endpoints require `?key=ADMIN_KEY` and are intended for maintenance:

```
GET /api/health                              — Health check
GET /api/list-users?key=                     — List all users
GET /api/test-email?key=&to=                 — Send test email
GET /api/add-member?key=&email=&boardId=&role= — Manually add user to board
GET /api/fix-owner?key=&email=              — Promote user to owner on all boards
```

---

## License

MIT
