/**
 * React hooks examples (for use in React components)
 *
 * Note: This file demonstrates the hooks API.
 * In a real React app, these would be in component files.
 */

// These hooks are designed for React components
// See src/hooks.ts for implementation

/*
import React from "react";
import {
  useLoggedState,
  useLoggedEffect,
  useLoggedCallback,
  useLoggedMemo,
  useRenderLog,
  useLifecycleLog,
  useLogger,
} from "nodelogger/hooks";

// ============================================
// 1. useLoggedState - Track state changes
// ============================================

function Counter() {
  // Logs every state change
  const [count, setCount] = useLoggedState(0, "count");

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}

// Output:
// DEBUG [useLoggedState:count] initialized { value: 0, renderCount: 1 }
// DEBUG [useLoggedState:count] changed { from: 0, to: 1, renderCount: 2 }

// ============================================
// 2. useLoggedEffect - Track effect execution
// ============================================

function DataFetcher({ userId }: { userId: string }) {
  const [data, setData] = useLoggedState(null, "data");

  useLoggedEffect(() => {
    let cancelled = false;

    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setData(data);
      });

    return () => {
      cancelled = true;
    };
  }, [userId], "fetchUser");

  return <div>{data ? JSON.stringify(data) : "Loading..."}</div>;
}

// Output:
// DEBUG [useLoggedEffect:fetchUser] running { runCount: 1, depsCount: 1 }
// DEBUG [useLoggedEffect:fetchUser] cleanup { runCount: 1 }

// ============================================
// 3. useLoggedCallback - Track callback invocations
// ============================================

function Form() {
  const [name, setName] = useLoggedState("", "name");

  const handleSubmit = useLoggedCallback(() => {
    console.log(`Submitting: ${name}`);
  }, [name], "handleSubmit");

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}

// Output:
// DEBUG [useLoggedCallback:handleSubmit] called { callCount: 1, argsCount: 1 }

// ============================================
// 4. useLoggedMemo - Track expensive computations
// ============================================

function ExpensiveList({ items }: { items: number[] }) {
  const sorted = useLoggedMemo(
    () => [...items].sort((a, b) => a - b),
    [items],
    "sortItems"
  );

  return (
    <ul>
      {sorted.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

// Output:
// DEBUG [useLoggedMemo:sortItems] computed { computeCount: 1, durationMs: "0.123" }

// ============================================
// 5. useRenderLog - Simple render tracking
// ============================================

function MyComponent() {
  useRenderLog("MyComponent");

  return <div>Hello</div>;
}

// Output:
// DEBUG [MyComponent] rendered { renderCount: 1 }

// ============================================
// 6. useLifecycleLog - Track mount/unmount
// ============================================

function Modal({ children }: { children: React.ReactNode }) {
  useLifecycleLog("Modal");

  return <div className="modal">{children}</div>;
}

// Output on mount:
// DEBUG [Modal] mounted { renderCount: 1 }
// Output on unmount:
// DEBUG [Modal] unmounted { totalRenders: 5 }

// ============================================
// 7. useLogger - Context-aware child logger
// ============================================

function UserProfile({ userId }: { userId: string }) {
  const log = useLogger("UserProfile", { userId });

  useEffect(() => {
    log.info("Profile viewed");
    return () => log.info("Profile closed");
  }, [log]);

  const handleEdit = () => {
    log.debug("Edit button clicked");
  };

  return (
    <div>
      <h1>User Profile</h1>
      <button onClick={handleEdit}>Edit</button>
    </div>
  );
}

// Output:
// INFO Profile viewed { component: "UserProfile", userId: "123" }
// DEBUG Edit button clicked { component: "UserProfile", userId: "123" }

// ============================================
// 8. Development-only logging
// ============================================

function DevOnlyComponent() {
  // Only logs in development, skipped in production
  const [value, setValue] = useLoggedState("", "devValue", { devOnly: true });

  useLoggedEffect(() => {
    console.log("Effect running");
  }, [value], "devEffect", { devOnly: true });

  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
*/

console.log(`
React Hooks Example
===================

This file demonstrates the React hooks available in NodeLogger.

Available hooks:
- useLoggedState    - Track state changes
- useLoggedEffect   - Track effect execution
- useLoggedCallback - Track callback invocations
- useLoggedMemo     - Track expensive computations
- useRenderLog      - Simple render tracking
- useLifecycleLog   - Track mount/unmount
- useLogger         - Context-aware child logger

Usage:
  import {
    useLoggedState,
    useLoggedEffect,
    // ...
  } from "nodelogger/hooks";

All hooks support a { devOnly: true } option to disable
logging in production builds.

✅ See the commented code above for usage examples.
`);
