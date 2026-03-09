# Architecture Explanation

## System Architecture

The Collaborative Task Manager follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                   Client Layer                   │
│              Next.js (React) + Tailwind          │
│         Axios (REST) + Socket.io-client          │
└──────────────────────┬──────────────────────────┘
                       │
            HTTP (REST) │ WebSocket (Socket.io)
                       │
┌──────────────────────┴──────────────────────────┐
│                Application Layer                 │
│         Express.js + Socket.io Server            │
│                                                  │
│  ┌─────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Routes  │→ │Controllers │→ │  Services    │  │
│  └─────────┘  └────────────┘  └──────────────┘  │
│       ↑                            ↓             │
│  ┌─────────┐              ┌──────────────┐       │
│  │Middleware│              │   Models     │       │
│  │(Auth,   │              │ (Mongoose)   │       │
│  │ Zod,   │              └──────┬───────┘       │
│  │ Error) │                     │                │
│  └─────────┘                    │                │
└─────────────────────────────────┼────────────────┘
                                  │
┌─────────────────────────────────┴────────────────┐
│                   Data Layer                      │
│                    MongoDB                        │
│  Collections: users, projects, tasks, comments    │
└──────────────────────────────────────────────────┘
```

### Request Flow

1. Client sends HTTP request or emits WebSocket event
2. Express middleware chain processes the request (CORS → JSON parsing → JWT auth → Zod validation)
3. Route handler delegates to the appropriate controller
4. Controller calls the service layer for business logic
5. Service layer interacts with Mongoose models
6. Response is returned to the client; if the action affects other users, a Socket.io event is broadcast

---

## Database Schema Design

### Design Philosophy

I chose **referenced documents** over embedded documents for several key reasons:

1. **Scalability**: Referenced comments can grow independently without bloating the parent Task document. MongoDB has a 16MB document size limit—embedding thousands of comments into a task would eventually hit this.

2. **Query flexibility**: With referenced comments in their own collection, I can query, paginate, and sort comments independently.

3. **Write contention**: Embedded arrays cause write contention when multiple users add comments simultaneously. Separate documents eliminate this.

### Schema Relationships

```
User (1) ──owns──→ (N) Project
User (N) ←─member─→ (N) Project
Project (1) ──has──→ (N) Task
User (N) ←─assigned─→ (N) Task
User (1) ──creates──→ (N) Task
Task (1) ──has──→ (N) Comment
User (1) ──writes──→ (N) Comment
```

### Data Models

**User**: Core authentication entity. Password stored as bcrypt hash (12 rounds). The `select: false` on password prevents accidental exposure in queries.

**Project**: Groups tasks and manages team membership. The `members` array stores ObjectId references to users. Owner is always included as a member on creation.

**Task**: Central entity with status tracking. Uses an enum for status (`todo`, `in-progress`, `done`) enforced at the schema level. Assignees stored as ObjectId array for many-to-many relationship.

**Comment**: Separate collection with `taskId` foreign key. This is the **referenced** approach rather than embedding comments inside tasks.

### Why Referenced Comments?

| Aspect | Embedded | Referenced (chosen) |
|--------|----------|---------------------|
| Read performance | Faster for small sets | Requires extra query |
| Write contention | High (array push on parent) | Low (independent inserts) |
| Document size | Risk of 16MB limit | No limit concerns |
| Pagination | Complex | Native with `.skip()` / cursor |
| Independent queries | Not possible | Full flexibility |

For a collaborative app where comments are frequent and potentially numerous, the referenced approach is the correct choice.

---

## Indexing Strategy

### Task Collection Indexes

```javascript
taskSchema.index({ projectId: 1, createdAt: -1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, assignees: 1 });
```

**Why these indexes?**

1. **`projectId + createdAt`**: The primary dashboard query fetches all tasks for a project, sorted by creation date. This compound index makes this an index-only sort (no in-memory sorting needed).

2. **`projectId + status`**: Dashboard filtering by status (`?status=todo`). Without this index, MongoDB would scan all tasks in the project and filter in memory.

3. **`projectId + assignees`**: Filtering by assignee (`?assignee=userId`). Since `assignees` is an array, MongoDB uses a **multikey index**, creating index entries for each element in the array.

### Comment Collection Index

```javascript
commentSchema.index({ taskId: 1, createdAt: -1 });
```

Comments are always fetched by task ID and displayed in chronological order. This compound index serves both filtering and sorting in a single index scan.

### Index Design Principles Applied

- **Equality-first, sort-last**: Compound indexes place equality filters (`projectId`) before range/sort fields (`createdAt`).
- **Cover common queries**: Each index maps directly to a specific API endpoint's query pattern.
- **Avoid over-indexing**: Only index fields used in query predicates. Extra indexes slow down writes.

---

## Cursor-Based Pagination

### Implementation

```javascript
const getProjectTasks = async (projectId, { cursor, limit = 20 }) => {
  const query = { projectId };

  if (cursor) {
    query._id = { $lt: new ObjectId(cursor) };
  }

  const tasks = await Task.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1);  // Fetch one extra to detect hasMore

  const hasMore = tasks.length > limit;
  const results = hasMore ? tasks.slice(0, limit) : tasks;
  const nextCursor = hasMore ? results[results.length - 1]._id : null;

  return { tasks: results, nextCursor, hasMore };
};
```

### Why Cursor Over Offset?

| Aspect | Offset (`skip/limit`) | Cursor-based |
|--------|----------------------|--------------|
| Performance at page 1000 | Scans 20,000 docs then skips | Direct index seek |
| Consistency with inserts | Duplicates/missing items | Stable results |
| Consistency with deletes | Items shift positions | Stable results |
| Implementation complexity | Simple | Moderate |
| Random page access | Yes | No |

**The critical issue with offset pagination** is that `skip(N)` forces MongoDB to scan and discard N documents. At page 1000 with 20 items per page, MongoDB scans 20,000 documents just to skip them. Cursor pagination uses an indexed `_id` comparison, performing an O(log n) B-tree seek regardless of position.

**Data consistency**: In a real-time collaborative app, tasks are constantly being created and deleted. Offset pagination produces duplicates (when items are inserted before the current offset) or missing items (when items are deleted). Cursor pagination always returns items after the last seen item, providing a consistent view.

---

## Real-Time Architecture

### Socket.io Room Design

```
Server
├── Room: "projectId_A"
│   ├── User 1 (socket)
│   └── User 2 (socket)
├── Room: "projectId_B"
│   └── User 3 (socket)
```

When a user opens a project dashboard, their socket joins the project's room:

```javascript
socket.on('joinProject', (projectId) => {
  socket.join(projectId);
});
```

### Event Flow

1. User creates a task via REST API (`POST /api/tasks`)
2. Controller calls the service layer to persist the task
3. After successful persistence, controller emits a Socket.io event to the project room
4. All connected clients in that room receive the event and update their local state

```javascript
// In task controller, after creating task:
const io = req.app.get('io');
io.to(task.projectId.toString()).emit('taskCreated', task);
```

### Events Broadcast

| Event | Trigger | Payload |
|-------|---------|---------|
| `taskCreated` | New task created | Full task object |
| `taskUpdated` | Task modified | Updated task object |
| `taskDeleted` | Task removed | `{ taskId, projectId }` |
| `taskStatusChanged` | Status changed | Updated task object |
| `commentAdded` | New comment | Comment with user info |
| `presenceUpdate` | User joins/leaves | Array of online users |

### Why REST + WebSocket (not pure WebSocket)?

1. **REST for mutations**: Provides reliable request/response semantics, HTTP status codes, and middleware pipeline (auth, validation, error handling)
2. **WebSocket for broadcasts**: One-to-many push is WebSocket's strength
3. **Fallback**: Socket.io gracefully falls back to long-polling if WebSocket is unavailable

---

## Presence Detection

### In-Memory Structure

```javascript
const projectPresence = {
  'projectId_A': [
    { userId: 'user1', name: 'Alice' },
    { userId: 'user2', name: 'Bob' },
  ],
  'projectId_B': [
    { userId: 'user3', name: 'Charlie' },
  ],
};
```

### Lifecycle

1. **Connection**: Socket authenticates via JWT in handshake
2. **Join**: User joins project room → added to presence map → broadcast `presenceUpdate`
3. **Leave**: User navigates away → removed from map → broadcast
4. **Disconnect**: Socket disconnects (tab close, network loss) → removed → broadcast

### Trade-offs

**In-memory storage is intentional** for this scale. Advantages:
- Zero latency for reads/writes
- No external dependency

**Limitations and scaling path**:
- Data lost on server restart
- Not shared across multiple server instances

**For production at scale**: Replace with Redis pub/sub. Each server instance publishes presence changes to a Redis channel, and all instances maintain synchronized state. Redis also provides key expiration for automatic cleanup of stale presence entries.

---

## Scalability Considerations

### Current Architecture Bottlenecks

1. **Single server instance**: Socket.io rooms are in-process. No horizontal scaling.
2. **In-memory presence**: Lost on restart, not shared across instances.
3. **MongoDB**: Single connection from one server.

### Scaling Strategy

**Phase 1 - Vertical Scaling**
- Increase server resources (CPU, RAM)
- Sufficient for hundreds of concurrent users

**Phase 2 - Horizontal Scaling with Redis**
```
Client → Load Balancer → Server 1 ─┐
                         Server 2 ─┤→ Redis (pub/sub + presence)
                         Server 3 ─┘
                              ↓
                           MongoDB (replica set)
```

- Use `@socket.io/redis-adapter` for cross-instance event broadcasting
- Move presence to Redis with TTL keys
- Configure sticky sessions on the load balancer for Socket.io

**Phase 3 - Microservices**
- Separate real-time service from REST API
- Use message queue (RabbitMQ/Kafka) for event propagation
- Independent scaling of read-heavy and write-heavy operations

### Database Scaling
- **Read replicas**: Route read queries to secondaries
- **Sharding**: Shard tasks collection by `projectId` for even distribution
- **Connection pooling**: Mongoose default pool handles concurrent connections

### Caching Strategy
- **Redis cache**: Cache frequently accessed project metadata and member lists
- **Client-side**: Socket.io events update local state, reducing API calls
- **Invalidation**: Socket events serve as cache invalidation signals
