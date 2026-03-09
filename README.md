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
git clone https://github.com/your-username/task-manager.git
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

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8001` |
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `task_manager` |
| `JWT_SECRET` | Secret key for JWT signing | *(required)* |
| `JWT_EXPIRES_IN` | Token expiration duration | `24h` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:8001`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL (e.g. `http://localhost:8001`) |

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