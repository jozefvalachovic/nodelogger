import { Logger } from "./logger";
import { LogLevel } from "./levels";

/**
 * Decorator options for method logging
 */
export interface LogDecoratorOptions {
  /** Log level */
  level?: LogLevel;

  /** Log method arguments */
  logArgs?: boolean;

  /** Log return value */
  logReturn?: boolean;

  /** Log execution timing */
  logTiming?: boolean;

  /** Keys to redact */
  redact?: string[];

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Audit decorator options
 */
export interface AuditDecoratorOptions {
  /** Audit action name */
  action: string;

  /** Additional static fields */
  fields?: Record<string, unknown>;

  /** Function to extract actor from arguments */
  extractActor?: (...args: unknown[]) => { id?: string; type?: string };

  /** Function to extract resource from arguments */
  extractResource?: (...args: unknown[]) => { id?: string; type?: string };
}

/**
 * Redact sensitive data from object
 */
function redactSensitive(obj: unknown, keysToRedact: string[]): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, keysToRedact));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (keysToRedact.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = redactSensitive(value, keysToRedact);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Method decorator for logging
 *
 * @example
 * class UserService {
 *   @Log({ level: LogLevel.INFO, logArgs: true, logReturn: true })
 *   async findUser(id: string): Promise<User> {
 *     // ...
 *   }
 * }
 */
export function Log(options: LogDecoratorOptions = {}) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const log = options.logger ?? Logger.getInstance();
    const level = options.level ?? LogLevel.DEBUG;

    const loggedMethod = function (this: unknown, ...args: unknown[]) {
      const className = target.constructor.name;
      const methodName = `${className}.${propertyKey}`;

      const startTime = options.logTiming ? performance.now() : 0;

      // Log args if enabled
      if (options.logArgs) {
        const safeArgs = options.redact ? redactSensitive(args, options.redact) : args;
        log.log(level, `[${methodName}] called`, { args: safeArgs });
      } else {
        log.log(level, `[${methodName}] called`);
      }

      const handleResult = (result: unknown) => {
        // Log timing
        if (options.logTiming) {
          const duration = performance.now() - startTime;
          log.log(level, `[${methodName}] completed`, {
            durationMs: duration.toFixed(3),
          });
        }

        // Log return if enabled
        if (options.logReturn && result !== undefined) {
          const safeResult = options.redact ? redactSensitive(result, options.redact) : result;
          log.log(level, `[${methodName}] returned`, { result: safeResult });
        }

        return result;
      };

      const handleError = (error: unknown) => {
        log.error(`[${methodName}] threw error`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      };

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods (including those returning Promises)
        if (result instanceof Promise) {
          return result.then(handleResult).catch(handleError);
        }

        // Handle sync methods
        return handleResult(result);
      } catch (error) {
        handleError(error);
      }
    };

    descriptor.value = loggedMethod;

    return descriptor;
  };
}

/**
 * Audit decorator for methods that should generate audit events
 *
 * @example
 * class UserService {
 *   @Log.audit({ action: "user_delete" })
 *   async deleteUser(id: string): Promise<void> {
 *     // ...
 *   }
 * }
 */
Log.audit = function (options: AuditDecoratorOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const log = Logger.getInstance();

    descriptor.value = async function (...args: unknown[]) {
      const className = target.constructor.name;
      const methodName = `${className}.${propertyKey}`;

      const auditData: Record<string, unknown> = {
        action: options.action,
        method: methodName,
        timestamp: new Date().toISOString(),
        ...options.fields,
      };

      // Extract actor if provided
      if (options.extractActor) {
        const actor = options.extractActor(...args);
        if (actor) {
          auditData.actorId = actor.id;
          auditData.actorType = actor.type;
        }
      }

      // Extract resource if provided
      if (options.extractResource) {
        const resource = options.extractResource(...args);
        if (resource) {
          auditData.resourceId = resource.id;
          auditData.resourceType = resource.type;
        }
      }

      try {
        const result = await originalMethod.apply(this, args);

        log.audit({
          ...auditData,
          outcome: "success",
        });

        return result;
      } catch (error) {
        log.audit({
          ...auditData,
          outcome: "failure",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return descriptor;
  };
};

/**
 * Class decorator to log all methods
 *
 * @example
 * @LogClass({ level: LogLevel.DEBUG })
 * class UserService {
 *   async findUser(id: string): Promise<User> { ... }
 *   async deleteUser(id: string): Promise<void> { ... }
 * }
 */
export function LogClass(options: LogDecoratorOptions = {}) {
  return function <T extends new (...args: unknown[]) => object>(constructor: T) {
    const prototype = constructor.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      if (propertyName === "constructor") continue;

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (descriptor && typeof descriptor.value === "function") {
        const decoratedDescriptor = Log(options)(prototype, propertyName, descriptor);
        Object.defineProperty(prototype, propertyName, decoratedDescriptor);
      }
    }

    return constructor;
  };
}

export { Log as LogMethod };
