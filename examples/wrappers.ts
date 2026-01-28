/**
 * Function wrapper examples for NodeLogger
 */
import { wrapFunction, wrapAsync, wrapComponent, loggerWrapper, Logger, LogLevel } from "../src";

// Initialize
Logger.init({ level: LogLevel.DEBUG });

// ============================================
// 1. Wrap a synchronous function
// ============================================

function calculateTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const loggedCalculateTotal = wrapFunction(calculateTotal, {
  name: "calculateTotal",
  logReturn: true,
  logTiming: true,
});

// Usage
const total = loggedCalculateTotal([
  { price: 10, quantity: 2 },
  { price: 5, quantity: 3 },
]);
console.log(`Total: ${total}`);

// ============================================
// 2. Wrap an async function
// ============================================

async function fetchUser(userId: string): Promise<{ id: string; name: string }> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { id: userId, name: "Alice" };
}

const loggedFetchUser = wrapAsync(fetchUser, {
  name: "fetchUser",
  logReturn: true,
  logTiming: true,
});

// Usage
loggedFetchUser("user-123").then((user) => {
  console.log(`Fetched user: ${user.name}`);
});

// ============================================
// 3. Universal wrapper (auto-detects type)
// ============================================

// Works with sync functions
const add = loggerWrapper((a: number, b: number) => a + b, { name: "add" });

// Works with async functions
const delay = loggerWrapper(async (ms: number) => new Promise((r) => setTimeout(r, ms)), {
  name: "delay",
  logTiming: true,
});

// ============================================
// 4. Wrap with specific props to log
// ============================================

interface UserUpdateProps {
  userId: string;
  email: string;
  password: string; // sensitive!
  settings: Record<string, unknown>;
}

async function updateUser(props: UserUpdateProps): Promise<void> {
  // Update logic
  console.log(`Updating user ${props.userId}`);
}

// Only log safe fields
const loggedUpdateUser = wrapAsync(updateUser, {
  name: "updateUser",
  logProps: ["userId", "email"], // Don't log password or settings
  redact: ["password"],
});

// Usage
loggedUpdateUser({
  userId: "user-123",
  email: "alice@example.com",
  password: "secret123",
  settings: { theme: "dark" },
});

// ============================================
// 5. React component wrapper (conceptual)
// ============================================

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Simulated React component
function Button(props: ButtonProps) {
  return { type: "button", props };
}

const LoggedButton = wrapComponent(Button, {
  name: "Button",
  logProps: ["label", "disabled"],
});

// When rendered, logs: [Button] render { label: "Submit", disabled: false }
LoggedButton({ label: "Submit", onClick: () => {}, disabled: false });

// ============================================
// 6. Shorthand syntax
// ============================================

// Log specific prop by name
const loggedFn1 = wrapAsync(fetchUser, "userId");

// Log multiple props
const loggedFn2 = wrapAsync(updateUser, ["userId", "email"]);

console.log("\nAll wrapper examples executed!");
