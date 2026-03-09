# 🗂️ Real-Time Collaborative Task Manager

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-green?logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black?logo=socket.io)
![License](https://img.shields.io/badge/License-MIT-blue)

A full-stack collaborative task management application with **real-time synchronization** powered by WebSockets. Multiple users can create projects, manage tasks, assign work, and communicate through comments — all with live updates across every connected client.

---

## ✨ Features

- 🔐 JWT-based authentication (register & login)
- 📁 Create and manage projects with team members
- ✅ Full task lifecycle — create, assign, update, delete
- 💬 Per-task commenting system
- 🔍 Full-text search across tasks and comments
- ⚡ Real-time updates via Socket.io rooms (scoped per project)
- 📄 Cursor-based pagination for task lists

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js + Express.js | REST API server |
| MongoDB + Mongoose | Database & ODM |
| Socket.io | Real-time WebSocket events |
| JWT | Authentication |
| Zod | Request validation |
| Jest | Unit testing |

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | UI framework |
| Axios | HTTP client |
| Socket.io-client | Real-time updates |
| Tailwind CSS | Styling |

---

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── models/          # Mongoose schemas (User, Project, Task, Comment)
│   │   ├── controllers/     # Route handlers
│   │   ├── routes/          # Express route definitions
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── services/        # Business logic layer
│   │   ├── sockets/         # Socket.io event handlers
│   │   └── validations/     # Zod schemas
│   ├── tests/               # Jest unit tests
│   ├── server.js            # Entry point
│   └── package.json
│
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   │   ├── login/           # Authentication page
│   │   ├── projects/        # Project listing
│   │   └── dashboard/       # Project task dashboard
│   ├── components/          # Reusable UI components
│   ├── lib/                 # API client & socket utilities
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18 — [Download](https://nodejs.org/)
- **MongoDB** >= 5.x — running locally or via [MongoDB Atlas](https://www.mongodb.com/atlas)
- **npm** >= 9

### 1. Clone the Repository

```bash
git clone https://github.com/ShivanshMehra02/distributed-task-manager.git
cd task-manager
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URL and JWT secret (see Environment Variables below)
npm install
npm start
```

The backend will start on `http://localhost:8001` by default.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:3000`.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=8001
MONGO_URL=mongodb://localhost:27017
DB_NAME=task_manager
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
CLIENT_URL=http://localhost:3000
```

| Variable | Used In | What It Does |
|----------|---------|--------------|
| `PORT` | `config/index.js` → `server.listen(config.port)` | Port the Express server binds to |
| `MONGO_URL` | `config/index.js` → `mongoose.connect(mongoUrl/dbName)` | MongoDB connection string (host only, no DB name) |
| `DB_NAME` | `config/index.js` → appended to `MONGO_URL` | Database name — final URI becomes `mongodb://localhost:27017/task_manager` |
| `JWT_SECRET` | `authService.js` → `jwt.sign()` / `auth.js` middleware → `jwt.verify()` | Secret key for signing and verifying JWT tokens |
| `JWT_EXPIRES_IN` | `authService.js` → `jwt.sign({ expiresIn })` | Token lifetime — `24h` means tokens expire after 24 hours |
| `CLIENT_URL` | `config/index.js` | Intended for restricting CORS origin in production (currently unused — server uses `*`) |

> **Note:** `CLIENT_URL` is not currently read by the CORS middleware (which is set to `*`). It's a placeholder for production use.

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8001
```

| Variable | Used In | What It Does |
|----------|---------|--------------|
| `NEXT_PUBLIC_API_URL` | `lib/api.js` → `axios.create({ baseURL })` | Must include `/api` at the end — all axios calls use relative paths like `/projects`, `/tasks` |
| `NEXT_PUBLIC_SOCKET_URL` | `lib/socket.js` → `io(SOCKET_URL, { path: '/api/socket.io' })` | Server origin only, without `/api` — the socket path is hardcoded as `/api/socket.io` |

> ⚠️ **Critical distinction:**
> ```
> NEXT_PUBLIC_API_URL    = http://localhost:8001/api   ← with /api
> NEXT_PUBLIC_SOCKET_URL = http://localhost:8001        ← without /api
> ```
> If you set `NEXT_PUBLIC_API_URL` without `/api`, every frontend request hits `/projects` instead of `/api/projects` and you'll get 404s.

### For Production / Deployed Environment

**Backend `.env`:**
```env
PORT=8001
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net
DB_NAME=task_manager
JWT_SECRET=a_strong_random_secret_at_least_32_chars
JWT_EXPIRES_IN=24h
CLIENT_URL=https://your-frontend-domain.com
```

**Frontend `.env`:**
```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
```

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests are written with **Jest** and cover the core service and controller logic.

---

## 📡 API Endpoints

All endpoints (except auth) require an `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive a JWT token |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects` | List all projects for the logged-in user |
| `GET` | `/api/projects/:id` | Get project details |
| `POST` | `/api/projects/:id/members` | Add a member to a project |
| `GET` | `/api/projects/:id/tasks` | Get paginated tasks for a project |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tasks` | Create a new task |
| `GET` | `/api/tasks/:id` | Get task details |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/:id/assign` | Assign a user to a task |
| `POST` | `/api/tasks/:id/unassign` | Unassign a user from a task |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tasks/:id/comments` | Add a comment to a task |
| `GET` | `/api/tasks/:id/comments` | Get all comments for a task |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=keyword` | Search across tasks and comments |

### Dashboard Filters & Pagination

```
GET /api/projects/:id/tasks?status=todo
GET /api/projects/:id/tasks?status=in-progress
GET /api/projects/:id/tasks?assignee=userId
GET /api/projects/:id/tasks?cursor=taskId&limit=20
```

---

## 🔧 Troubleshooting

**MongoDB connection fails**
Make sure MongoDB is running locally (`mongod`) or your Atlas connection string in `.env` is correct.

**CORS errors in the browser**
Ensure `CLIENT_URL` in the backend `.env` matches the exact URL of your frontend (including port).

**JWT errors / 401 Unauthorized**
Check that `JWT_SECRET` is set and that your frontend is sending the `Authorization: Bearer <token>` header with every request.

**Socket not connecting**
Verify `NEXT_PUBLIC_SOCKET_URL` in the frontend `.env` points to the correct backend URL.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
