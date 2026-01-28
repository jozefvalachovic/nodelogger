import type * as React from "react";
import { Logger } from "./logger";
import { LogLevel } from "./levels";
import type { LoggerConfig } from "./config";

/**
 * Options for the logger wrapper
 */
export interface WrapperOptions<T = unknown> {
  /** Log level for this wrapper */
  level?: LogLevel | LogLevel[];

  /** Specific props/arguments to log (by name or index) - for single object argument */
  logProps?: (keyof T | string | number)[];

  /** Log all props/arguments */
  logAllProps?: boolean;

  /** Log all function arguments (for multi-argument functions) */
  logArgs?: boolean;

  /** Names for function arguments (for cleaner output with multi-arg functions) */
  argNames?: string[];

  /** Log the return value */
  logReturn?: boolean;

  /** Log execution timing */
  logTiming?: boolean;

  /** Custom name for logging (defaults to function name) */
  name?: string;

  /** Keys to redact from logged data */
  redact?: string[];

  /** Custom logger instance */
  logger?: Logger;

  /** Additional context to include */
  context?: Record<string, unknown>;
}

/**
 * Internal: check if current log level matches wrapper options
 */
function shouldLogForLevel(options: WrapperOptions, config: Readonly<LoggerConfig>): boolean {
  if (!options.level) return true;

  const levels = Array.isArray(options.level) ? options.level : [options.level];
  return levels.some((level) => level >= config.level);
}

/**
 * Internal: extract props to log from arguments
 */
function extractLogProps<T extends Record<string, unknown>>(
  props: T,
  options: WrapperOptions<T>,
): Record<string, unknown> {
  if (options.logAllProps) {
    return { ...props };
  }

  if (!options.logProps || options.logProps.length === 0) {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const key of options.logProps) {
    if (typeof key === "string" && key in props) {
      result[key] = props[key];
    } else if (typeof key === "number") {
      // For array-like access
      const keys = Object.keys(props);
      if (key < keys.length) {
        const k = keys[key];
        result[k] = props[k];
      }
    }
  }

  return result;
}

/**
 * Internal: extract function arguments to log
 */
function extractArgsToLog(args: unknown[], options: WrapperOptions): Record<string, unknown> {
  if (!options.logArgs && !options.logAllProps) {
    return {};
  }

  // If argNames provided, use them
  if (options.argNames && options.argNames.length > 0) {
    const result: Record<string, unknown> = {};
    for (let i = 0; i < Math.min(args.length, options.argNames.length); i++) {
      result[options.argNames[i]] = args[i];
    }
    return result;
  }

  // Otherwise use index-based naming
  if (args.length === 1) {
    // Single argument - return it directly if it's an object, otherwise wrap it
    const arg = args[0];
    if (arg && typeof arg === "object" && !Array.isArray(arg)) {
      return arg as Record<string, unknown>;
    }
    return { arg0: arg };
  }

  // Multiple arguments - use arg0, arg1, etc.
  const result: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    result[`arg${i}`] = args[i];
  }
  return result;
}

/**
 * Internal: redact sensitive data
 */
function redactData(
  data: Record<string, unknown>,
  keysToRedact: string[],
  mask: string = "[REDACTED]",
): Record<string, unknown> {
  if (keysToRedact.length === 0) return data;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (keysToRedact.includes(key)) {
      result[key] = mask;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactData(value as Record<string, unknown>, keysToRedact, mask);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Type for any function
 */
type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Type for async functions
 */
type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

/**
 * Wrap a synchronous function with logging
 */
export function wrapFunction<F extends AnyFunction>(
  fn: F,
  options: WrapperOptions | string | (string | number)[] = {},
): F {
  // Normalize options
  const opts: WrapperOptions =
    typeof options === "string"
      ? { logProps: [options] }
      : Array.isArray(options)
        ? { logProps: options as (string | number)[] }
        : options;

  const log = opts.logger ?? Logger.getInstance();
  const config = log.getConfig();
  const fnName = opts.name ?? fn.name ?? "anonymous";

  const wrapped = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    if (!shouldLogForLevel(opts, config)) {
      return fn.apply(this, args) as ReturnType<F>;
    }

    const startTime = opts.logTiming ? performance.now() : 0;

    // Extract data to log - support both single object props and multiple args
    let dataToLog: Record<string, unknown> = {};

    if (opts.logArgs || opts.argNames) {
      // Multi-argument mode
      dataToLog = extractArgsToLog(args, { ...opts, logArgs: true });
    } else if (opts.logAllProps || opts.logProps) {
      // Single object argument mode (React-style props)
      const propsArg = args[0];
      if (propsArg && typeof propsArg === "object") {
        dataToLog = extractLogProps(propsArg as Record<string, unknown>, opts);
      }
    }

    const logData = {
      ...opts.context,
      ...(Object.keys(dataToLog).length > 0 ? dataToLog : {}),
    };

    // Redact if needed
    const safeData = opts.redact ? redactData(logData, opts.redact) : logData;

    log.debug(`[${fnName}] called`, safeData);

    try {
      const result = fn.apply(this, args);

      if (opts.logTiming) {
        const duration = performance.now() - startTime;
        log.debug(`[${fnName}] completed`, { durationMs: duration.toFixed(3) });
      }

      if (opts.logReturn && result !== undefined) {
        log.debug(`[${fnName}] returned`, { result });
      }

      return result as ReturnType<F>;
    } catch (error) {
      log.error(`[${fnName}] threw error`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  } as F;

  // Preserve function name
  Object.defineProperty(wrapped, "name", { value: fnName, configurable: true });

  return wrapped;
}

/**
 * Wrap an async function with logging
 */
export function wrapAsync<F extends AsyncFunction>(
  fn: F,
  options: WrapperOptions | string | (string | number)[] = {},
): F {
  // Normalize options
  const opts: WrapperOptions =
    typeof options === "string"
      ? { logProps: [options] }
      : Array.isArray(options)
        ? { logProps: options as (string | number)[] }
        : options;

  const log = opts.logger ?? Logger.getInstance();
  const config = log.getConfig();
  const fnName = opts.name ?? fn.name ?? "anonymous";

  const wrapped = async function (
    this: unknown,
    ...args: Parameters<F>
  ): Promise<Awaited<ReturnType<F>>> {
    if (!shouldLogForLevel(opts, config)) {
      return fn.apply(this, args) as Awaited<ReturnType<F>>;
    }

    const startTime = opts.logTiming ? performance.now() : 0;

    // Extract data to log - support both single object props and multiple args
    let dataToLog: Record<string, unknown> = {};

    if (opts.logArgs || opts.argNames) {
      // Multi-argument mode
      dataToLog = extractArgsToLog(args, { ...opts, logArgs: true });
    } else if (opts.logAllProps || opts.logProps) {
      // Single object argument mode (React-style props)
      const propsArg = args[0];
      if (propsArg && typeof propsArg === "object") {
        dataToLog = extractLogProps(propsArg as Record<string, unknown>, opts);
      }
    }

    const logData = {
      ...opts.context,
      ...(Object.keys(dataToLog).length > 0 ? dataToLog : {}),
    };

    const safeData = opts.redact ? redactData(logData, opts.redact) : logData;

    log.debug(`[${fnName}] called`, safeData);

    try {
      const result = await fn.apply(this, args);

      if (opts.logTiming) {
        const duration = performance.now() - startTime;
        log.debug(`[${fnName}] completed`, { durationMs: duration.toFixed(3) });
      }

      if (opts.logReturn && result !== undefined) {
        log.debug(`[${fnName}] returned`, { result });
      }

      return result as Awaited<ReturnType<F>>;
    } catch (error) {
      log.error(`[${fnName}] threw error`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  } as F;

  Object.defineProperty(wrapped, "name", { value: fnName, configurable: true });

  return wrapped;
}

/**
 * React component type - properly typed for JSX compatibility
 */
type ReactNode = React.ReactNode;
type ComponentType<P> = (props: P) => ReactNode;

/**
 * Wrap a React component (client or server) with prop logging
 */
export function wrapComponent<P extends Record<string, unknown>, C extends ComponentType<P>>(
  Component: C,
  options: WrapperOptions<P> | keyof P | (keyof P)[] = {},
): C {
  // Normalize options
  let opts: WrapperOptions<P>;
  if (typeof options === "string") {
    opts = { logProps: [options] } as WrapperOptions<P>;
  } else if (Array.isArray(options)) {
    opts = { logProps: options } as WrapperOptions<P>;
  } else {
    opts = options as WrapperOptions<P>;
  }

  const log = opts.logger ?? Logger.getInstance();
  const config = log.getConfig();
  const componentName = opts.name ?? Component.name ?? "Component";

  // Track render counts
  const renderCounts = new Map<string, number>();

  const WrappedComponent = function (props: P): ReactNode {
    if (!shouldLogForLevel(opts as WrapperOptions, config)) {
      return Component(props);
    }

    // Track renders
    const renderKey = componentName;
    const renderCount = (renderCounts.get(renderKey) ?? 0) + 1;
    renderCounts.set(renderKey, renderCount);

    // Extract props to log
    const propsToLog = extractLogProps(props, opts);

    const logData: Record<string, unknown> = {
      ...opts.context,
      ...(Object.keys(propsToLog).length > 0 ? propsToLog : {}),
    };

    if (config.logRenderCount) {
      logData.renderCount = renderCount;
    }

    const safeData = opts.redact ? redactData(logData, opts.redact) : logData;

    log.debug(`[${componentName}] render`, safeData);

    return Component(props);
  } as C;

  // Preserve component name for React DevTools
  (WrappedComponent as unknown as { displayName: string }).displayName = `Logged(${componentName})`;
  Object.defineProperty(WrappedComponent, "name", {
    value: componentName,
    configurable: true,
  });

  return WrappedComponent;
}

/**
 * Universal logger wrapper - automatically detects function type
 */
export function loggerWrapper<T extends AnyFunction>(
  fn: T,
  options?: WrapperOptions | string | (string | number)[],
): T {
  // Check if it's an async function
  if (fn.constructor.name === "AsyncFunction") {
    return wrapAsync(fn as AsyncFunction, options) as T;
  }

  return wrapFunction(fn, options) as T;
}

// Export as default
export default loggerWrapper;
