"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Logger } from "./logger";
import { LogLevel } from "./levels";

/**
 * Options for logged hooks
 */
export interface LoggedHookOptions {
  /** Hook name for logging */
  name?: string;

  /** Log level */
  level?: LogLevel;

  /** Custom logger instance */
  logger?: Logger;

  /** Only log in development */
  devOnly?: boolean;
}

/**
 * Check if we should log (respects devOnly option)
 */
function shouldLog(options: LoggedHookOptions): boolean {
  if (options.devOnly && process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

/**
 * A useState hook that logs state changes
 *
 * @example
 * const [count, setCount] = useLoggedState(0, "count");
 */
export function useLoggedState<T>(
  initialValue: T,
  name: string,
  options: LoggedHookOptions = {},
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const renderCount = useRef(0);
  const [value, setValue] = useState(initialValue);

  // Track renders
  renderCount.current++;

  // Log initial value on mount
  useEffect(() => {
    if (shouldLog(options)) {
      log.log(level, `[useLoggedState:${name}] initialized`, {
        value,
        renderCount: renderCount.current,
      });
    }

  }, []);

  // Wrapped setter that logs changes
  const setValueWithLog = useCallback(
    (newValueOrUpdater: React.SetStateAction<T>) => {
      setValue((prev) => {
        const newValue =
          typeof newValueOrUpdater === "function"
            ? (newValueOrUpdater as (prev: T) => T)(prev)
            : newValueOrUpdater;

        if (shouldLog(options) && prev !== newValue) {
          log.log(level, `[useLoggedState:${name}] changed`, {
            from: prev,
            to: newValue,
            renderCount: renderCount.current,
          });
        }

        return newValue;
      });
    },
    [log, level, name, options],
  );

  return [value, setValueWithLog];
}

/**
 * A useEffect hook that logs when it runs and cleans up
 *
 * @example
 * useLoggedEffect(() => {
 *   // effect
 *   return () => { // cleanup };
 * }, [dep], "myEffect");
 */
export function useLoggedEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList | undefined,
  name: string,
  options: LoggedHookOptions = {},
): void {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const runCount = useRef(0);

  useEffect(() => {
    if (!shouldLog(options)) {
      return effect();
    }

    runCount.current++;

    log.log(level, `[useLoggedEffect:${name}] running`, {
      runCount: runCount.current,
      depsCount: deps?.length ?? 0,
    });

    const cleanup = effect();

    if (cleanup) {
      return () => {
        log.log(level, `[useLoggedEffect:${name}] cleanup`, {
          runCount: runCount.current,
        });
        cleanup();
      };
    }

    return undefined;

  }, deps);
}

/**
 * A useCallback hook that logs when the callback is called
 *
 * @example
 * const handleClick = useLoggedCallback(
 *   () => { doSomething(); },
 *   [dep],
 *   "handleClick"
 * );
 */
export function useLoggedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList,
  name: string,
  options: LoggedHookOptions = {},
): T {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const callCount = useRef(0);

  // Use refs to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return useCallback(
    ((...args: Parameters<T>) => {
      if (shouldLog(optionsRef.current)) {
        callCount.current++;
        log.log(level, `[useLoggedCallback:${name}] called`, {
          callCount: callCount.current,
          argsCount: args.length,
        });
      }
      return callback(...args);
    }) as T,

    deps,
  );
}

/**
 * A useMemo hook that logs when the value is recomputed
 *
 * @example
 * const expensiveValue = useLoggedMemo(
 *   () => computeExpensive(data),
 *   [data],
 *   "expensiveComputation"
 * );
 */
export function useLoggedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  name: string,
  options: LoggedHookOptions = {},
): T {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const computeCount = useRef(0);

  return useMemo(() => {
    if (shouldLog(options)) {
      computeCount.current++;
      const startTime = performance.now();
      const result = factory();
      const duration = performance.now() - startTime;

      log.log(level, `[useLoggedMemo:${name}] computed`, {
        computeCount: computeCount.current,
        durationMs: duration.toFixed(3),
      });

      return result;
    }

    return factory();

  }, deps);
}

/**
 * Hook to track component render count
 *
 * @example
 * function MyComponent() {
 *   useRenderLog("MyComponent");
 *   return <div>...</div>;
 * }
 */
export function useRenderLog(componentName: string, options: LoggedHookOptions = {}): void {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const renderCount = useRef(0);

  renderCount.current++;

  useEffect(() => {
    if (shouldLog(options)) {
      log.log(level, `[${componentName}] rendered`, {
        renderCount: renderCount.current,
      });
    }
  });
}

/**
 * Hook to log component lifecycle
 *
 * @example
 * function MyComponent() {
 *   useLifecycleLog("MyComponent");
 *   return <div>...</div>;
 * }
 */
export function useLifecycleLog(componentName: string, options: LoggedHookOptions = {}): void {
  const log = options.logger ?? Logger.getInstance();
  const level = options.level ?? LogLevel.DEBUG;
  const renderCount = useRef(0);

  renderCount.current++;

  useEffect(() => {
    if (shouldLog(options)) {
      log.log(level, `[${componentName}] mounted`, {
        renderCount: renderCount.current,
      });

      return () => {
        log.log(level, `[${componentName}] unmounted`, {
          totalRenders: renderCount.current,
        });
      };
    }

    return undefined;

  }, []);
}

/**
 * Hook to create a logger with component context
 *
 * @example
 * function MyComponent({ userId }) {
 *   const log = useLogger("MyComponent", { userId });
 *   log.info("Processing");
 * }
 */
export function useLogger(componentName: string, context: Record<string, unknown> = {}) {
  const log = Logger.getInstance();

  return useMemo(
    () => log.child({ component: componentName, ...context }),

    [componentName, ...Object.values(context)],
  );
}
