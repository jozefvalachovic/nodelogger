/**
 * Next.js middleware and route handler examples
 *
 * Note: This file demonstrates the API. In a real Next.js app,
 * these would be in separate files under app/ directory.
 */
import { Logger, LogLevel } from "../src";
import {
  createNextMiddleware,
  withLogging,
  withServerAction,
  middlewareMetrics,
} from "../src/middleware";

// Initialize logger
Logger.init({
  level: LogLevel.DEBUG,
  colorize: true,
  enableMetrics: true,
});

// ============================================
// 1. Edge Middleware
// ============================================

/**
 * middleware.ts
 *
 * This runs on the edge for every matched request.
 */
export const middleware = createNextMiddleware({
  skipPaths: ["/api/health", "/api/ready", "/_next"],
  skipPathPrefixes: ["/static"],
  requestId: true,
  requestIdHeader: "X-Request-ID",
  enableAudit: true,
  auditMethods: ["POST", "PUT", "DELETE"],
  customFields: {
    service: "my-nextjs-app",
    version: "1.0.0",
  },
});

// Middleware config
export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};

// ============================================
// 2. Route Handler Wrapper
// ============================================

/**
 * app/api/users/route.ts
 */

// Simulated Next.js types
interface NextRequest {
  method: string;
  url: string;
  nextUrl: { pathname: string; search: string };
  headers: Headers;
  json: () => Promise<unknown>;
}

// Mock handler
async function GET(request: NextRequest): Promise<Response> {
  const users = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];
  return Response.json({ users });
}

async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const newUser = { id: "3", ...(body as object) };
  return Response.json(newUser, { status: 201 });
}

// Export wrapped handlers
// export const GET = withLogging(GET);
// export const POST = withLogging(POST, {
//   logBodyOnErrors: true,
//   enableAudit: true,
// });

// ============================================
// 3. Server Action Wrapper
// ============================================

/**
 * app/actions.ts
 */

// "use server";

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

async function createUser(formData: FormData): Promise<{ id: string; name: string }> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Simulate creating user
  console.log(`Creating user: ${name} (${email})`);

  return { id: "user-123", name };
}

async function deleteUser(userId: string): Promise<void> {
  // Simulate deleting user
  console.log(`Deleting user: ${userId}`);
}

// Wrapped server actions
const wrappedCreateUser = withServerAction(createUser, {
  name: "createUser",
  logArgs: true,
  redact: ["password"],
  enableAudit: true,
});

const wrappedDeleteUser = withServerAction(deleteUser, {
  name: "deleteUser",
  logArgs: true,
  logReturn: true,
  enableAudit: true,
});

// ============================================
// 4. Metrics Access
// ============================================

// Get middleware metrics
const metrics = middlewareMetrics.getMetrics();
console.log("Middleware Metrics:", metrics);

// Reset metrics (e.g., periodically)
// middlewareMetrics.reset();

// ============================================
// Demo: Simulate requests
// ============================================

async function demo() {
  console.log("\n=== Next.js Middleware Demo ===\n");

  // Simulate a server action call
  const formData = new FormData();
  formData.append("name", "Charlie");
  formData.append("email", "charlie@example.com");
  formData.append("password", "secret123");

  console.log("Calling createUser server action...");
  const user = await wrappedCreateUser(formData);
  console.log(`Created user: ${user.name} (${user.id})`);

  console.log("\nCalling deleteUser server action...");
  await wrappedDeleteUser("user-123");

  console.log("\n✅ Demo completed!");
}

// FormData polyfill for Node.js < 18
if (typeof FormData === "undefined") {
  console.log("FormData not available in this Node.js version, skipping demo");
} else {
  demo().catch(console.error);
}
