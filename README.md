# NodeLogger

[![CI](https://github.com/jozefvalachovic/nodelogger/actions/workflows/ci.yml/badge.svg)](https://github.com/jozefvalachovic/nodelogger/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/nodelogger.svg)](https://www.npmjs.com/package/nodelogger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A beautiful, high-performance logger for TypeScript/React with colorized output, function wrappers, and enterprise audit features. Designed for Next.js, React, and Node.js applications.

## Features

- 🌈 **Colorized log levels** — Trace, Debug, Info, Notice, Warn, Error, Audit with automatic color coding
- 📊 **Structured logging** — Key-value pairs with JSON-like output
- 🎯 **Function Wrappers** — Log function/component calls based on environment
- ⚛️ **React Support** — Component wrappers, logged hooks, render tracking
- 🔐 **Audit logging** — Enterprise-grade audit with hash chain and compliance presets
- 🌐 **Middleware** — Next.js, Express middleware with request logging
- 🔄 **Context support** — Distributed tracing with context-aware logging
- ⚙️ **Fully configurable** — Output destination, log levels, colors, time format
- 🚀 **High performance** — Optimized with singleton pattern and batch writes
- 🎲 **Log Sampling** — Reduce log volume by sampling a percentage of messages
- 📈 **Metrics** — Built-in log metrics collection and reporting

### Enterprise Audit Features

- 🛡️ **Tamper Detection** — SHA-256/512 hash chain for audit log integrity
- 📤 **Multi-Sink Support** — Write to files, webhooks, and custom destinations
- 🏢 **Compliance Presets** — SOC2, HIPAA, PCI-DSS, GDPR, and FedRAMP configurations
- 🔍 **Query & Export API** — Search audit logs and export to JSON, JSONL, or CSV

## Installation

```bash
npm install nodelogger

# or
yarn add nodelogger

# or
pnpm add nodelogger
```

### Installing from GitHub

```bash
# npm
npm install github:jozefvalachovic/nodelogger

# pnpm
pnpm add github:jozefvalachovic/nodelogger
```

### pnpm Workspaces / Turborepo

When using pnpm workspaces, add the package to `onlyBuiltDependencies` in your `pnpm-workspace.yaml` to allow the build script to run:

```yaml
onlyBuiltDependencies:
  - "nodelogger"
```

## Quick Start

### Basic Logging

```typescript
import { Logger, logger } from "nodelogger";

// Initialize with config
Logger.init({
  level: LogLevel.DEBUG,
  colorize: true,
});

// Use the singleton
logger.info("Hello, world!", { user: "alice" });
logger.error("Something failed", { error: "timeout" });

// Audit logs - structured data only
logger.audit({
  action: "user_login",
  userId: "123",
  ipAddress: "192.168.1.1",
  success: true,
});
```

### Function Wrapper

```typescript
import loggerWrapper from "nodelogger";

// Wrap any function to log its calls
async function fetchUserById(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Logs calls when LOG_LEVEL=DEBUG
export const fetchUser = loggerWrapper(fetchUserById, {
  logArgs: true,
  logReturn: true,
  logTiming: true,
});
```

### React Component Wrapper

```typescript
import { wrapComponent } from "nodelogger";

interface UserCardProps {
  userId: string;
  name: string;
  email: string;
  password: string; // sensitive!
}

function UserCard(props: UserCardProps) {
  return <div>{props.name}</div>;
}

// Only logs specified props, redacts sensitive ones
export default wrapComponent(UserCard, {
  logProps: ["userId", "name"],
  redact: ["password"],
});
```

### React Server Component

```typescript
import { wrapComponent } from "nodelogger";

async function UserPage({ params }: { params: { id: string } }) {
  const user = await getUser(params.id);
  return <UserProfile user={user} />;
}

// Works with async server components
export default wrapComponent(UserPage, ["params"]);
```

## Log Levels

The logger supports the following log levels with distinct colors:

| Level    | Color     | Description                          |
| -------- | --------- | ------------------------------------ |
| `TRACE`  | Gray      | Very detailed tracing                |
| `DEBUG`  | Purple    | Detailed debugging information       |
| `INFO`   | Blue      | General information                  |
| `NOTICE` | Green     | Normal but significant events        |
| `WARN`   | Yellow    | Warning conditions                   |
| `ERROR`  | Red       | Error conditions                     |
| `AUDIT`  | Bold Cyan | Security and compliance audit events |

## Configuration

```typescript
import { Logger, LogLevel } from "nodelogger";

Logger.init({
  level: LogLevel.INFO,
  output: "stdout",
  colorize: true,
  timeFormat: "short", // "iso" | "unix" | "relative" | "short" | "none"
  redactKeys: ["password", "token", "secret"],
  redactMask: "[REDACTED]",
  sampleRate: 1.0,
  batchWrites: false,
  enableMetrics: true,
  customFields: { service: "my-api" },
  prettyPrint: true,
});

// Environment-based configuration
// Set LOG_LEVEL=DEBUG in your .env
```

## React Hooks

```typescript
import {
  useLoggedState,
  useLoggedEffect,
  useLoggedCallback,
  useLoggedMemo,
  useRenderLog,
  useLifecycleLog,
  useLogger,
} from "nodelogger/hooks";

function MyComponent({ userId }: { userId: string }) {
  // Log state changes
  const [count, setCount] = useLoggedState(0, "count");

  // Log effect triggers
  useLoggedEffect(() => {
    fetchData();
    return () => cleanup();
  }, [userId], "fetchData");

  // Log callback invocations
  const handleClick = useLoggedCallback(() => {
    setCount((c) => c + 1);
  }, [setCount], "handleClick");

  // Log expensive computations
  const processed = useLoggedMemo(
    () => expensiveOperation(data),
    [data],
    "processData"
  );

  // Track render count
  useRenderLog("MyComponent");

  // Track mount/unmount
  useLifecycleLog("MyComponent");

  // Get a child logger with context
  const log = useLogger("MyComponent", { userId });
  log.info("Processing");

  return <button onClick={handleClick}>Count: {count}</button>;
}
```

## Decorators

```typescript
import { Log, LogClass, LogLevel } from "nodelogger";

class UserService {
  @Log({ level: LogLevel.INFO, logArgs: true, logReturn: true })
  async findUser(id: string): Promise<User> {
    return db.users.find(id);
  }

  @Log.audit({ action: "user_delete" })
  async deleteUser(id: string): Promise<void> {
    await db.users.delete(id);
  }
}

// Or log all methods in a class
@LogClass({ level: LogLevel.DEBUG })
class OrderService {
  async createOrder(data: OrderData) { ... }
  async cancelOrder(id: string) { ... }
}
```

## Next.js Middleware

### Route Handler Wrapper

```typescript
// app/api/users/route.ts
import { withLogging } from "nodelogger/middleware";

async function GET(request: NextRequest) {
  const users = await getUsers();
  return Response.json({ users });
}

async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await createUser(body);
  return Response.json(user, { status: 201 });
}

export const GET = withLogging(GET);
export const POST = withLogging(POST, {
  enableAudit: true,
  logBodyOnErrors: true,
});
```

### Server Action Wrapper

```typescript
// app/actions.ts
"use server";

import { withServerAction } from "nodelogger/middleware";

async function createUser(formData: FormData) {
  const name = formData.get("name");
  return db.users.create({ name });
}

export const createUser = withServerAction(createUser, {
  name: "createUser",
  logArgs: true,
  enableAudit: true,
  redact: ["password"],
});
```

### Edge Middleware

```typescript
// middleware.ts
import { createNextMiddleware } from "nodelogger/middleware";

export const middleware = createNextMiddleware({
  skipPaths: ["/api/health", "/_next"],
  enableAudit: true,
  auditMethods: ["POST", "PUT", "DELETE"],
});

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
```

## Express Middleware

```typescript
import express from "express";
import { expressMiddleware, expressErrorMiddleware } from "nodelogger/middleware";

const app = express();

// Request logging
app.use(
  expressMiddleware({
    skipPaths: ["/health", "/ready"],
    enableMetrics: true,
    enableAudit: true,
  }),
);

// Your routes
app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

// Error logging
app.use(expressErrorMiddleware());

app.listen(3000);
```

## Enterprise Audit Logging

### Quick Start

```typescript
import { AuditLogger, EventType, Outcome, Compliance } from "nodelogger/audit";

// Create with compliance preset
const audit = AuditLogger.withCompliance(Compliance.SOC2, {
  serviceName: "my-service",
  serviceVersion: "1.0.0",
});

// Log audit events
await audit.log({
  type: EventType.AUTH,
  action: "user_login",
  outcome: Outcome.SUCCESS,
  actorId: "user-123",
  actorIp: "192.168.1.100",
  description: "User successfully logged in",
});

// Shorthand methods
await audit.success(EventType.DATA_ACCESS, "read_document", {
  resourceId: "doc-456",
  resourceType: "document",
});

await audit.failure(EventType.AUTHZ, "access_denied", new Error("Forbidden"), {
  actorId: "user-789",
  resourceId: "admin-panel",
});
```

### Compliance Presets

| Preset  | Retention | Hash Chain | Signatures       |
| ------- | --------- | ---------- | ---------------- |
| SOC2    | 1 year    | ✅ SHA-256 | ❌               |
| HIPAA   | 6 years   | ✅ SHA-512 | ✅               |
| PCI-DSS | 1 year    | ✅ SHA-256 | ❌               |
| GDPR    | 90 days   | ✅ SHA-256 | ❌ (auto-delete) |
| FedRAMP | 3 years   | ✅ SHA-512 | ✅               |

### Query & Export

```typescript
import { AuditLogger, EventType, Outcome, ExportFormat } from "nodelogger/audit";

const audit = new AuditLogger();

// Query audit logs
const result = await audit.query({
  timeRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
  },
  eventTypes: [EventType.AUTH, EventType.AUTHZ],
  outcomes: [Outcome.FAILURE],
  actorIds: ["user-123"],
  limit: 100,
});

console.log(`Found ${result.total} entries`);

// Export to file
await audit.export("audit-export.csv", result.entries, ExportFormat.CSV);
```

### Custom Sinks

```typescript
import { AuditLogger } from "nodelogger/audit";

const audit = new AuditLogger({
  sinks: [
    { type: "console" },
    { type: "file", path: "./logs/audit.jsonl" },
    {
      type: "webhook",
      url: "https://siem.example.com/ingest",
      headers: { Authorization: "Bearer token" },
    },
    {
      type: "custom",
      handler: async (entry) => {
        await sendToDatadog(entry);
      },
    },
  ],
});
```

## Metrics

```typescript
import { Logger, logger } from "nodelogger";

Logger.init({ enableMetrics: true });

// Log some messages
logger.info("Request processed");
logger.warn("High latency");
logger.error("Connection failed");

// Get metrics
const metrics = logger.getMetrics();
console.log({
  totalLogs: metrics.totalLogs,
  errorRate: metrics.errorRate,
  avgLogsPerSecond: metrics.avgLogsPerSecond,
  byLevel: metrics.byLevel,
});

// Reset metrics
logger.resetMetrics();
```

## Example Output

### Console Output (colorized)

```
10:04:12 INFO   Hello, world! {
  "user": "alice"
}

10:04:12 DEBUG  [UserCard] render {
  "userId": "123",
  "name": "Alice"
}

10:04:12 INFO   GET /api/users [200] 15.234ms

10:04:12 AUDIT  {
  "action": "user_login",
  "userId": "123",
  "outcome": "success"
}
```

### JSON Output

```json
{"timestamp":"2025-01-28T10:04:12.000Z","level":"INFO","message":"Hello, world!","user":"alice"}
{"timestamp":"2025-01-28T10:04:12.000Z","level":"DEBUG","component":"UserCard","event":"render","userId":"123"}
```

## Package Structure

```
nodelogger/
├── src/
│   ├── index.ts        # Main exports
│   ├── logger.ts       # Core logger
│   ├── config.ts       # Configuration
│   ├── levels.ts       # Log levels & colors
│   ├── formatter.ts    # Output formatting
│   ├── wrapper.ts      # Function/component wrappers
│   ├── decorators.ts   # Class/method decorators
│   ├── hooks.ts        # React hooks
│   ├── middleware/
│   │   ├── index.ts    # Middleware exports
│   │   ├── base.ts     # Shared middleware logic
│   │   ├── next.ts     # Next.js middleware
│   │   └── express.ts  # Express middleware
│   └── audit/
│       ├── index.ts    # Audit exports
│       ├── types.ts    # Audit types
│       ├── config.ts   # Audit configuration
│       ├── logger.ts   # Audit logger
│       ├── chain.ts    # Hash chain
│       └── store.ts    # Storage backends
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test -- --watch

# Type check
npm run typecheck

# Build
npm run build
```

## License

MIT
