# Interview Preparation Guide

## Question 1: Why did you choose referenced comments instead of embedding them in the Task document?

**Answer:**
I chose referenced comments (separate collection) over embedded documents for three primary reasons:

1. **Document size limit**: MongoDB has a 16MB document size limit. In a collaborative app, tasks could accumulate hundreds or thousands of comments. Embedding them would risk hitting this limit and cause increasingly slow reads as the array grows.

2. **Write contention**: When multiple users comment simultaneously on the same task, embedded arrays cause write contention because each comment is an update to the same parent document. With referenced comments, each insert is an independent document creation with no contention.

3. **Query independence**: Referenced comments can be paginated, sorted, and queried independently. I can efficiently fetch "latest 20 comments" without loading the entire task document.

**Follow-up: When would embedding be the better choice?**

**Answer:**
Embedding is better when: (a) the embedded data is always read together with the parent (e.g., a user's address), (b) the embedded array has a bounded, small size (e.g., max 5 tags on a task), and (c) the embedded data doesn't need independent querying. For example, task `assignees` are stored as an embedded array of ObjectIds because there's a natural upper bound (team size) and they're always read with the task.

---

## Question 2: Explain your indexing strategy. How did you decide which indexes to create?

**Answer:**
I created indexes based on actual query patterns in the API:

- **`{ projectId: 1, createdAt: -1 }`**: Serves the dashboard query that fetches all tasks for a project sorted by creation date. The compound index allows MongoDB to both filter by `projectId` and sort by `createdAt` in a single index scan.

- **`{ projectId: 1, status: 1 }`**: Serves the status filter query (`?status=todo`). Without this, filtering by status would require scanning all project tasks.

- **`{ projectId: 1, assignees: 1 }`**: Serves the assignee filter. Since `assignees` is an array, MongoDB creates a multikey index with entries for each array element.

- **`{ taskId: 1, createdAt: -1 }`** on comments: Every comment fetch is by task ID sorted by time.

The design principle is **equality filters first, range/sort fields second** in compound indexes, and only index fields that appear in query predicates.

**Follow-up: What's the cost of having too many indexes?**

**Answer:**
Each index: (1) consumes RAM and disk space, (2) slows down write operations because every insert/update/delete must update all affected indexes, (3) increases lock contention. The rule is to index for your read patterns but be disciplined—unused indexes are pure overhead. I use `db.collection.getIndexes()` and MongoDB's `$indexStats` aggregation to identify unused indexes in production.

---

## Question 3: Why cursor-based pagination instead of offset pagination?

**Answer:**
Two critical reasons:

1. **Performance**: Offset pagination using `skip(N)` forces MongoDB to scan and discard N documents sequentially. At page 500 with 20 items/page, that's 10,000 documents scanned just to skip them. Cursor pagination does a B-tree seek on the `_id` index, which is O(log n) regardless of position.

2. **Consistency**: In a real-time app where tasks are constantly created and deleted, offset pagination produces duplicates (new items shift existing ones forward) or gaps (deleted items shift items backward). Cursor pagination provides a stable view—"give me everything after this ID."

**Follow-up: What are the limitations of cursor pagination?**

**Answer:**
(1) No random page access—you can't jump to "page 50." (2) Requires a stable, unique, sortable field (like `_id` or a timestamp). (3) More complex for multi-column sorting. For this use case, these limitations are acceptable because task lists are typically scrolled sequentially, not randomly accessed.

---

## Question 4: How does your real-time architecture work? Walk me through what happens when User A creates a task.

**Answer:**
1. User A's browser sends a POST request to `/api/tasks` with the task data and JWT token.
2. Express middleware authenticates the JWT, validates the request body with Zod, and passes to the controller.
3. The controller calls `taskService.createTask()` which persists the task to MongoDB.
4. After successful creation, the controller accesses the Socket.io instance (`req.app.get('io')`) and emits a `taskCreated` event to the project's room: `io.to(projectId).emit('taskCreated', task)`.
5. User B, who has a Socket.io client connected and joined the same project room, receives the `taskCreated` event.
6. User B's React state handler adds the new task to the local task list, causing a re-render.

The key design decision is **REST for mutations + WebSocket for notifications**. Mutations go through REST to leverage the full middleware pipeline (auth, validation, error handling with HTTP status codes). WebSocket handles the one-to-many broadcast.

**Follow-up: Why not use WebSocket for everything?**

**Answer:**
WebSocket doesn't have a built-in request/response model. With REST: (1) the client gets immediate confirmation of success/failure via HTTP status codes, (2) middleware (auth, validation, error handling) is standardized and composable, (3) retries and caching follow HTTP semantics, (4) API is independently testable with curl/Postman. Socket.io is optimized for server-initiated push, not request-response patterns.

---

## Question 5: Explain your Socket.io room architecture.

**Answer:**
Each project has a dedicated Socket.io room identified by its `projectId`. When a user navigates to a project dashboard, their socket client emits `joinProject(projectId)`, and the server calls `socket.join(projectId)`. This means events emitted to that room via `io.to(projectId).emit(...)` only reach users currently viewing that project.

This is efficient because: (1) events are scoped—a task update in Project A doesn't reach users in Project B, (2) Socket.io rooms are lightweight (just a Set of socket IDs), (3) users can be in multiple rooms simultaneously if viewing multiple projects.

**Follow-up: How would you handle rooms across multiple server instances?**

**Answer:**
Socket.io rooms are process-local by default. For horizontal scaling, I'd use the `@socket.io/redis-adapter`. This adapter uses Redis pub/sub: when Server 1 emits to a room, the message is published to Redis, and all other servers subscribed to that channel re-emit it to their local room members. The sticky sessions on the load balancer ensure a client's polling/WebSocket connection always hits the same server instance.

---

## Question 6: How do you handle JWT authentication in Socket.io connections?

**Answer:**
Socket.io supports middleware on the `io.use()` level, which runs before the `connection` event. I extract the JWT from `socket.handshake.auth.token`, verify it with `jwt.verify()`, look up the user in MongoDB, and attach the user info to the socket object (`socket.userId`, `socket.userName`). If authentication fails, I call `next(new Error(...))` which rejects the connection.

This is important because: (1) every socket connection is authenticated, (2) the user identity is available for all subsequent events without re-checking, (3) if the token is invalid/expired, the connection is rejected before any room joining.

**Follow-up: What happens when a JWT expires while a socket is connected?**

**Answer:**
The socket remains connected because JWT is only checked at connection time. To handle this properly: (1) set a periodic re-authentication check where the server verifies the token at intervals, (2) use a shorter-lived token with a refresh mechanism, or (3) emit a `tokenExpired` event from the server and force the client to reconnect with a fresh token. For this project, the 24-hour token expiry and connection-time check is sufficient.

---

## Question 7: How does your presence detection work? What are its limitations?

**Answer:**
Presence is tracked in-memory using a plain JavaScript object: `projectPresence = { projectId: [{ userId, name }] }`. When a user joins a project room, they're added to the array. On disconnect, they're removed. The presence array is broadcast to all room members after every change.

Limitations:
1. **Single-instance only**: The in-memory map isn't shared across server instances.
2. **Volatile**: Data is lost on server restart.
3. **No staleness detection**: If a socket hangs without proper disconnect, the user appears "online" forever.

**Follow-up: How would you make presence detection production-ready?**

**Answer:**
Use Redis with expiring keys. Each user's presence is stored as a key like `presence:projectId:userId` with a TTL of 30 seconds. The client sends periodic heartbeats (every 15 seconds), which resets the TTL. If the heartbeat stops (disconnect, crash), the key auto-expires. For broadcasting changes, use Redis pub/sub with a `__keyevent@0__:expired` subscription to detect departures. This handles all three limitations: works across instances, survives restarts (with minor gap), and auto-cleans stale entries.

---

## Question 8: Explain your error handling strategy.

**Answer:**
Three layers:

1. **Service layer**: Business logic errors throw custom errors with `statusCode` property (e.g., `err.statusCode = 404`). This keeps HTTP semantics out of the business logic while providing enough info for the error handler.

2. **Controller layer**: Every controller wraps service calls in try/catch and passes errors to `next(err)`, delegating to the global handler.

3. **Global error handler middleware**: Catches all errors and returns consistent JSON responses. It handles specific error types: `ValidationError` (400), `CastError` (400 for invalid MongoDB IDs), duplicate key (409), and falls back to 500 for unknown errors.

**Follow-up: Why not use async/await error handling with a wrapper function?**

**Answer:**
A wrapper like `asyncHandler(fn)` that catches promise rejections is a valid alternative. I opted for explicit try/catch in controllers for clarity—each controller method explicitly shows its error handling path. Both approaches are valid; the wrapper reduces boilerplate at the cost of implicit error flow.

---

## Question 9: How does your Zod validation middleware work?

**Answer:**
The validation middleware is a higher-order function that takes a Zod schema and returns an Express middleware. It calls `schema.safeParse(req.body)`, which validates the request body without throwing. If validation fails, it returns a 400 response with structured error details (field names and messages). If validation passes, it attaches the parsed (and potentially transformed) data to `req.validatedBody`, which controllers use instead of raw `req.body`.

Benefits: (1) type coercion and defaults applied automatically, (2) controllers receive pre-validated, typed data, (3) consistent error format across all endpoints.

**Follow-up: Why Zod over Joi or express-validator?**

**Answer:**
Zod: (1) has excellent TypeScript inference (even in JS projects, it provides better IntelliSense), (2) is smaller in bundle size, (3) offers a more composable API with `.transform()`, `.refine()`, and schema composition, (4) is actively maintained with a growing ecosystem. Joi is more mature but larger, and express-validator ties validation to Express specifically.

---

## Question 10: How would you handle database transactions in this application?

**Answer:**
Currently, most operations are single-document writes which are atomic in MongoDB. For multi-document operations (e.g., deleting a task and all its comments), I'd use MongoDB sessions and transactions:

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Task.findByIdAndDelete(taskId, { session });
  await Comment.deleteMany({ taskId }, { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

This requires a MongoDB replica set. For the current single-instance setup, I rely on atomic single-document operations and accept eventual consistency for cross-collection operations.

**Follow-up: What if you can't use transactions (standalone MongoDB)?**

**Answer:**
Without transactions: (1) order operations so partial failure is acceptable (delete comments first, then task—orphaned comments are less harmful than a task referencing deleted comments), (2) use compensating operations (on failure, undo previous steps), (3) implement the Saga pattern for complex workflows, (4) add cleanup jobs that detect and resolve inconsistencies periodically.

---

## Question 11: How do you handle concurrent modifications to the same task?

**Answer:**
Currently, I use a **last-write-wins** strategy which is acceptable for a collaborative task manager (latest status change should win). For stronger consistency, I'd implement **optimistic concurrency control** using a version field:

```javascript
const task = await Task.findOneAndUpdate(
  { _id: taskId, __v: expectedVersion },
  { $set: updates, $inc: { __v: 1 } },
  { new: true }
);
if (!task) throw new Error('Conflict: task was modified');
```

The client sends the version it read. If another write incremented the version, the update fails, and the client must re-read and retry.

**Follow-up: How does this interact with your real-time system?**

**Answer:**
The real-time system actually helps here. When User A updates a task, the `taskUpdated` event is broadcast, and User B's local state is immediately refreshed. So by the time User B tries to modify the task, they're likely working with the latest version. Optimistic concurrency is the safety net for the rare race condition where two users submit changes within milliseconds.

---

## Question 12: Explain the Node.js event loop and how it relates to handling concurrent requests in your application.

**Answer:**
Node.js uses a single-threaded event loop with non-blocking I/O. When a request arrives:

1. The event loop picks it up from the event queue
2. Synchronous code (JSON parsing, validation) runs on the main thread
3. Async operations (MongoDB queries, bcrypt hashing) are delegated to the thread pool (libuv) or the OS (network I/O)
4. Callbacks/promises are queued when async operations complete
5. The event loop processes the next callback

In my app, the heaviest operations (bcrypt hashing, MongoDB queries) are all async. This means the event loop is free to accept new connections while waiting for I/O. A single Node.js process can handle thousands of concurrent connections because it never blocks on I/O.

**Follow-up: What would block the event loop in your app?**

**Answer:**
(1) Synchronous bcrypt (I use `bcrypt.hash` which is async and uses the thread pool), (2) large JSON serialization, (3) complex Zod validation on huge payloads, (4) a regex-based search on a very long string. To monitor, I'd use `--prof` flag or `perf_hooks` to measure event loop lag. If blocking is detected, move the work to a Worker Thread.

---

## Question 13: How would you implement rate limiting for your API?

**Answer:**
I'd implement rate limiting at multiple levels:

1. **Global rate limit**: Using `express-rate-limit` middleware with a Redis store. Example: 100 requests per minute per IP.
2. **Endpoint-specific**: Stricter limits on auth endpoints (5 login attempts per minute) to prevent brute force.
3. **User-specific**: After authentication, rate limit by user ID rather than IP to handle shared IPs (corporate networks).

For Socket.io, I'd track event frequency per socket and disconnect abusive clients.

**Follow-up: How would you handle rate limiting in a distributed system?**

**Answer:**
Use Redis as a shared rate limit store. The sliding window algorithm stores timestamps of recent requests in a sorted set. Each server checks and updates the same Redis key, ensuring consistent limits across instances. Libraries like `rate-limiter-flexible` support Redis natively.

---

## Question 14: How would you implement role-based access control?

**Answer:**
I'd add a `role` field to the project membership:

```javascript
members: [{
  userId: { type: ObjectId, ref: 'User' },
  role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'] }
}]
```

Then create middleware that checks both membership and role:

```javascript
const authorize = (...roles) => (req, res, next) => {
  const member = project.members.find(m => m.userId.equals(req.userId));
  if (!member || !roles.includes(member.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

**Follow-up: How would you handle permission inheritance?**

**Answer:**
Define a permission hierarchy: `owner > admin > member > viewer`. Each role inherits permissions from roles below it. Store permissions as a set: `{ canCreateTask, canDeleteTask, canManageMembers, canChangeSettings }`. Check against the permission set rather than the role name for flexibility.

---

## Question 15: What is the N+1 query problem and how do you avoid it?

**Answer:**
The N+1 problem occurs when you fetch a list of N items, then make N additional queries to fetch related data for each item. Example: fetch 20 tasks, then 20 separate queries to get each task's creator.

I avoid it using Mongoose's `.populate()` which translates to a `$lookup` or batch `$in` query:

```javascript
const tasks = await Task.find({ projectId })
  .populate('assignees', 'name email avatar')
  .populate('createdBy', 'name email avatar');
```

This resolves to 3 queries total (tasks + users for assignees + users for createdBy) regardless of how many tasks are returned.

**Follow-up: What are the limitations of populate?**

**Answer:**
(1) It's still multiple round trips to the database—not a true join. (2) For very deep nesting, it becomes inefficient. (3) It doesn't work across databases. For complex queries, I'd use MongoDB's `$lookup` aggregation stage which performs the join server-side in a single operation.

---

## Question 16: How would you implement full-text search at scale?

**Answer:**
My current search uses regex (`new RegExp(query, 'i')`) which works for small datasets but doesn't scale because: (1) regex can't use standard indexes effectively (only prefix matches benefit), (2) no relevance scoring, (3) no stemming or fuzzy matching.

For production:
1. **MongoDB Atlas Search**: Built-in Lucene-based search with text indexes, fuzzy matching, autocomplete, and relevance scoring.
2. **Elasticsearch**: External search service. Sync data via change streams. Provides full-text search, aggregations, and suggestions.

**Follow-up: How would you keep a search index in sync with MongoDB?**

**Answer:**
Use MongoDB Change Streams to watch for inserts, updates, and deletes on the tasks and comments collections. A worker process consumes these change events and updates the Elasticsearch index in near-real-time. For initial indexing, run a bulk import from MongoDB to Elasticsearch.

---

## Question 17: How do you handle file uploads in a collaborative app?

**Answer:**
For task attachments, I'd: (1) use presigned URLs for direct-to-S3 uploads (bypasses the Node.js server), (2) store the S3 key and metadata in the task document, (3) serve files via CloudFront CDN for performance. The flow: client requests presigned URL → server generates it with S3 SDK → client uploads directly to S3 → client notifies server with the file key → server updates the task.

**Follow-up: Why presigned URLs instead of proxying through the server?**

**Answer:**
Proxying large files through Node.js: (1) consumes server memory and bandwidth, (2) blocks the event loop for large transfers, (3) doubles the data transfer (client→server→S3). Presigned URLs let the client upload directly to S3 with temporary, scoped credentials, eliminating the server as a bottleneck.

---

## Question 18: How would you implement WebSocket reconnection and message buffering?

**Answer:**
Socket.io has built-in reconnection (`reconnection: true`, `reconnectionAttempts`, `reconnectionDelay`). On reconnect:

1. Client re-authenticates with the stored JWT
2. Client re-joins the project room
3. Client fetches the current state via REST API to catch any events missed during disconnection

For critical events (task assignments), I'd implement server-side buffering: store the last N events per room in Redis. On reconnect, the client sends the timestamp of its last received event, and the server replays missed events.

**Follow-up: What about message ordering guarantees?**

**Answer:**
Socket.io guarantees in-order delivery per connection. Across reconnections, use event IDs or timestamps to detect duplicates and maintain ordering. For strict ordering requirements, I'd use a message queue (RabbitMQ) as the event source with sequential message IDs.

---

## Question 19: Explain MongoDB's write concern and read concern. How do they apply to your app?

**Answer:**
**Write concern** determines how many replica set members must acknowledge a write before it's considered successful. `w: 1` (default) waits for the primary. `w: "majority"` waits for a majority of members, ensuring the write survives a primary failover.

**Read concern** determines the consistency level of reads. `"local"` returns the latest data from the queried member. `"majority"` returns only data acknowledged by a majority.

For my app, I'd use `w: "majority"` for critical writes (user registration, task creation) and `"local"` read concern for dashboard queries (acceptable to show slightly stale data for better performance).

**Follow-up: What is the performance impact of `w: "majority"`?**

**Answer:**
Each write waits for acknowledgment from a majority of nodes, adding network round-trip latency (typically 1-5ms in the same data center). The trade-off is durability vs. latency. For a task manager, the added latency is imperceptible to users.

---

## Question 20: How would you monitor your application in production?

**Answer:**
Three pillars of observability:

1. **Metrics**: Use Prometheus to collect request latency, error rates, active WebSocket connections, MongoDB query times, event loop lag. Visualize with Grafana.

2. **Logging**: Structured JSON logging with Winston. Log request ID, user ID, and operation for correlation. Ship logs to ELK stack or Datadog.

3. **Tracing**: OpenTelemetry for distributed tracing across the request lifecycle. Traces show: HTTP request → middleware → service → MongoDB query → Socket.io emit.

**Follow-up: What specific metrics would you alert on?**

**Answer:**
(1) Error rate > 1% of requests (P1 alert), (2) p99 latency > 2 seconds, (3) MongoDB connection pool exhaustion, (4) Event loop lag > 100ms, (5) WebSocket connection count anomaly (sudden spike could indicate attack), (6) Failed auth attempts spike (brute force detection).

---

## Question 21: How does bcrypt work and why did you choose it?

**Answer:**
Bcrypt is a password hashing algorithm that: (1) uses a computationally expensive key derivation function (Blowfish-based), (2) incorporates a random salt (preventing rainbow table attacks), (3) has a configurable cost factor (number of rounds).

With 12 rounds (my choice), each hash takes ~250ms on modern hardware. This is intentionally slow—fast enough for login (one hash) but prohibitively slow for brute force (millions of hashes).

I use `bcryptjs` (pure JavaScript implementation) for portability across environments without native compilation dependencies.

**Follow-up: What about Argon2?**

**Answer:**
Argon2 is the newer winner of the Password Hashing Competition. It's memory-hard (resistant to GPU attacks) in addition to being CPU-hard. For new projects, Argon2id is the better choice. I used bcrypt here because: (1) it's the most widely adopted and battle-tested, (2) `bcryptjs` has zero native dependencies, (3) for this project's scope, bcrypt's security is sufficient.

---

## Question 22: How would you implement a notification system for this app?

**Answer:**
Layered approach:

1. **In-app notifications**: Store in a `notifications` collection (`userId`, `type`, `data`, `read`, `createdAt`). When a task is assigned to a user, create a notification document and push it via Socket.io.

2. **Push notifications**: Use Web Push API with service workers. Server stores push subscriptions per user and sends push notifications for important events (task assigned, mentioned in comment).

3. **Email notifications**: Queue emails via a job queue (Bull/BullMQ with Redis). Batch notifications to avoid spam—digest every 15 minutes.

**Follow-up: How do you handle notification preferences?**

**Answer:**
Store per-user preferences: `{ email: { taskAssigned: true, commentMention: true }, push: { taskAssigned: false } }`. Check preferences before queuing any notification. Provide a settings page for users to toggle preferences.

---

## Question 23: What are MongoDB Change Streams and how would you use them?

**Answer:**
Change Streams provide a real-time feed of changes to a MongoDB collection (requires replica set). Instead of polling for changes, you open a stream:

```javascript
const changeStream = Task.watch([
  { $match: { operationType: { $in: ['insert', 'update', 'delete'] } } }
]);

changeStream.on('change', (event) => {
  // Broadcast to relevant Socket.io room
  io.to(event.fullDocument.projectId).emit('taskUpdated', event.fullDocument);
});
```

This would decouple the real-time notifications from the API layer—any change to the database (even from another service or direct DB modification) triggers a broadcast.

**Follow-up: Change Streams vs. the current approach of emitting in controllers?**

**Answer:**
Controller-based emission: simpler, synchronous with the request, but only catches changes made through the API. Change Streams: catch all changes regardless of source, enable event-driven architecture, but add complexity and latency (change propagation through oplog). For a single-service architecture, controller-based emission is cleaner. For microservices, Change Streams are essential.

---

## Question 24: How would you design a task activity/audit log?

**Answer:**
Create an `Activity` model:

```javascript
{
  projectId: ObjectId,
  taskId: ObjectId,
  userId: ObjectId,
  action: String, // 'created', 'updated', 'statusChanged', 'assigned', 'commented'
  changes: Object, // { field: 'status', from: 'todo', to: 'done' }
  timestamp: Date,
}
```

Log activities in the service layer after each mutation. Index on `{ projectId: 1, timestamp: -1 }` for project activity feed and `{ taskId: 1, timestamp: -1 }` for task history. Use cursor pagination for the activity feed.

**Follow-up: How would you handle high-volume activity logging without impacting API performance?**

**Answer:**
(1) Write activities asynchronously—don't await the insert in the request path. (2) Use a write-behind buffer: batch activities in memory and flush to MongoDB every N seconds. (3) For very high volume, write to a message queue (Kafka) and consume asynchronously. (4) Use a time-series collection in MongoDB 5.0+ for efficient time-based storage and queries.

---

## Question 25: How would you deploy this application to production?

**Answer:**
1. **Containerization**: Dockerize backend and frontend separately with multi-stage builds
2. **Orchestration**: Kubernetes with separate deployments for backend (3+ replicas) and frontend (2+ replicas)
3. **Database**: MongoDB Atlas (managed) with a 3-node replica set
4. **Load balancing**: Ingress controller (nginx) with sticky sessions for Socket.io
5. **CI/CD**: GitHub Actions → build → test → push Docker image → deploy to K8s
6. **Secrets**: Kubernetes secrets for JWT_SECRET, MONGO_URL
7. **CDN**: CloudFront for frontend static assets

**Follow-up: How would you handle zero-downtime deployments?**

**Answer:**
Rolling updates in Kubernetes: (1) deploy new pods alongside old ones, (2) readiness probes ensure new pods are accepting traffic before old pods terminate, (3) `terminationGracePeriodSeconds` allows in-flight requests to complete, (4) for WebSocket connections, the old pods continue serving existing connections while new connections go to new pods. Socket.io clients automatically reconnect when their pod terminates.

---

## Question 26: How does Socket.io handle transport fallback?

**Answer:**
Socket.io attempts WebSocket first, then falls back to HTTP long-polling. The handshake: (1) client initiates HTTP long-polling connection, (2) server responds with session ID, (3) client attempts to upgrade to WebSocket, (4) if WebSocket succeeds, long-polling is dropped; if not, long-polling continues.

This is important because: corporate firewalls and proxies sometimes block WebSocket. Long-polling is HTTP-based and works through any proxy. The upgrade mechanism ensures the best available transport is used.

**Follow-up: What's the performance difference between WebSocket and long-polling?**

**Answer:**
WebSocket: single persistent TCP connection, bidirectional, minimal overhead per message (2-14 bytes framing). Long-polling: new HTTP request per message, includes full HTTP headers (~500 bytes overhead), higher latency (wait for response → new request). For frequent events (presence updates, typing indicators), WebSocket can be 10-50x more efficient.

---

## Question 27: Explain the middleware pattern in Express.js and how you use it.

**Answer:**
Express middleware are functions with the signature `(req, res, next)` that form a pipeline. Each middleware can: (1) modify req/res, (2) end the request, or (3) pass to the next middleware via `next()`.

My middleware stack:
1. **CORS**: Adds cross-origin headers
2. **JSON parser**: Parses request body
3. **Auth middleware**: Verifies JWT, attaches user to req
4. **Validation middleware**: Runs Zod schema on req.body
5. **Controller**: Handles business logic
6. **Error handler**: Catches and formats errors

The order matters: auth must come before validation (which may reference the user), and the error handler must be last (Express recognizes 4-parameter functions as error handlers).

**Follow-up: How do you handle middleware that applies to some routes but not others?**

**Answer:**
Three approaches: (1) Apply to specific routers: `router.use(authenticate)` applies auth to all routes in that router. (2) Apply per-route: `router.get('/protected', authenticate, controller)`. (3) Conditional middleware: check the route path inside middleware and skip if not applicable. I use approach (1) for auth (all project/task routes are protected) and approach (2) for validation (each route has its specific schema).
