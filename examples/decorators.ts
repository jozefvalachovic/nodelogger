/**
 * TypeScript decorator examples
 */
import { Logger, LogLevel } from "../src";
import { Log, LogClass } from "../src/decorators";

// Initialize logger
Logger.init({
  level: LogLevel.DEBUG,
  colorize: true,
});

// ============================================
// 1. Method decorator - @Log
// ============================================

class UserService {
  @Log({ level: LogLevel.INFO, logArgs: true, logReturn: true })
  async findUser(id: string): Promise<{ id: string; name: string }> {
    // Simulate database call
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { id, name: "Alice" };
  }

  @Log({ level: LogLevel.DEBUG, logTiming: true })
  async updateUser(id: string, data: { name?: string; email?: string }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    console.log(`Updated user ${id}`);
  }

  @Log({ logArgs: true, redact: ["password"] })
  async createUser(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ id: string }> {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return { id: "new-user-123" };
  }
}

// ============================================
// 2. Audit decorator - @Log.audit
// ============================================

class AdminService {
  @Log.audit({
    action: "user_suspended",
    extractActor: (adminId: string) => ({ id: adminId, type: "admin" }),
    extractResource: (_: string, userId: string) => ({ id: userId, type: "user" }),
  })
  async suspendUser(adminId: string, userId: string, reason: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    console.log(`User ${userId} suspended by ${adminId}: ${reason}`);
  }

  @Log.audit({
    action: "config_changed",
    fields: { category: "system" },
  })
  async updateSystemConfig(key: string, value: unknown): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log(`Config ${key} updated to ${value}`);
  }
}

// ============================================
// 3. Class decorator - @LogClass
// ============================================

@LogClass({ level: LogLevel.DEBUG, logTiming: true })
class OrderService {
  async createOrder(
    userId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<{ orderId: string }> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { orderId: "order-123" };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25));
    console.log(`Order ${orderId} cancelled`);
  }

  async getOrderStatus(orderId: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return "shipped";
  }
}

// ============================================
// Demo
// ============================================

async function demo() {
  console.log("\n=== Decorator Examples ===\n");

  const userService = new UserService();
  const adminService = new AdminService();
  const orderService = new OrderService();

  // Method decorator examples
  console.log("--- @Log decorator ---");
  await userService.findUser("user-123");
  await userService.updateUser("user-123", { name: "Bob" });
  await userService.createUser({
    name: "Charlie",
    email: "charlie@example.com",
    password: "secret123", // Will be redacted
  });

  // Audit decorator examples
  console.log("\n--- @Log.audit decorator ---");
  await adminService.suspendUser("admin-001", "user-999", "Policy violation");
  await adminService.updateSystemConfig("max_connections", 100);

  // Class decorator examples
  console.log("\n--- @LogClass decorator ---");
  await orderService.createOrder("user-123", [
    { productId: "prod-1", quantity: 2 },
    { productId: "prod-2", quantity: 1 },
  ]);
  await orderService.cancelOrder("order-456");
  await orderService.getOrderStatus("order-123");

  console.log("\n✅ All decorator examples completed!");
}

demo().catch(console.error);
