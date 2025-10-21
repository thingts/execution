# @thingts/timing

Async-friendly **throttle** and **debounce** utilities for modern TypeScript.

Both functions handle synchronous and asynchronous code transparently, always
return a `Promise`, and guarantee that **all coalesced calls share the same
result**.  Each returned Promise resolves (or rejects) once the wrapped
function has executed and settled and the timing requirements have been met.

---

## ✨ Features

- 🧠 **Promise-aware:** works cleanly with async or sync functions  
- 🔁 **Single shared Promise:** all coalesced calls share one result  
- ⏳ **Precise async semantics:** resolve when the wrapped function settles  
- ⚙️ **Type-safe:** modern TypeScript, fully generic  
- ⚡ **Lightweight:** zero dependencies, <1 kB gzipped  
- 🪶 **Flexible:** configurable invocation edge and execution sequence

---

## 📦 Installation

```bash
npm install @thingts/timing
```

---

## 🧩 API

### `throttle(fn, delay, options?)`

Limits how often `fn` can run.

Each call returns a **Promise** that resolves after the corresponding throttled execution has completed.  
All calls that start within the same timing period share the same Promise.

```ts
import { throttle } from '@thingts/timing'

const throttledFetch = throttle(async (url: string) => {
  const res = await fetch(url)
  return res.json()
}, 1000)

await Promise.all([
  throttledFetch('/data'),
  throttledFetch('/data'),
]) // both resolve with the same result
```

#### Execution order (`sequence`)

Controls how successive throttled runs relate to each other — especially when the wrapped function takes longer to finish than the throttle delay.

| Option | Description |
|---------|--------------|
| `'serial'` *(default)* | Wait for the previous run to finish before starting the next. If the delay has already passed, start immediately. Ensures no overlap and maximum throughput. |
| `'concurrent'` | Allow a new run to start once the delay has elapsed, even if the previous run is still running. Useful for event-rate throttling where overlap is harmless. |
| `'gap'` | Wait for the previous run to finish **and** then wait at least `delay` ms before starting the next. Guarantees an idle period between completions — ideal for API rate limits. |

> This option only affects behavior when `fn` may take longer to run than the throttle delay.

#### Example

```ts
const t1 = throttle(fn, 1000, { sequence: 'concurrent' }) // allow overlaps
const t2 = throttle(fn, 1000, { sequence: 'serial' })     // back-to-back
const t3 = throttle(fn, 1000, { sequence: 'gap' })        // enforce idle gap
```

---

### `debounce(fn, delay, options?)`

Merges rapid sequences of calls into a single logical *burst* of calls, coalesced into one execution of the wrapped function.

Think of a **noisy button** that bounces when pressed — if pressed again within a short interval, that’s treated as the same action.  
The debounced function ensures `fn` only runs **once per burst** of closely spaced calls.

Each call returns a **Promise** that resolves after the coalesced execution has completed.  
All calls within the same burst share the same Promise and result.

```ts
import { debounce } from '@thingts/timing'

const debouncedSave = debounce(async (doc: Document) => {
  await saveToServer(doc)
}, 500, { edge: 'trailing', sequence: 'serial' })

debouncedSave(myDoc)
debouncedSave(myDoc)
// Both resolve together once the save completes
```

#### Invocation timing (`edge`)

Controls **when** the wrapped function is invoked within each burst:

- `'leading'` — run immediately on the first call.  
- `'trailing'` — run after `delay` ms of quiet following the last call.

In both cases, the debounce timer resets each time the function is called.

#### Overlap behavior (`sequence`)

Controls **whether new bursts can overlap** with an ongoing execution.  
This option only matters when the wrapped function can take longer to settle than the debounce delay.

| Option | Description |
|---------|--------------|
| `'serial'` *(default)* | Don’t start a new burst until the previous one finishes — ensures no overlap. |
| `'concurrent'` | Allow a new burst while the previous is still running — useful when calls are independent or idempotent. |

#### Summary

- A **burst** is a group of closely spaced calls.  
- `edge` controls *when* to invoke within the burst.  
- `sequence` controls *whether bursts may overlap* when `fn` runs longer than the delay.  
- All calls within the same burst share one Promise and one result.

---

## 🧪 Example: synchronous function

Even synchronous functions are wrapped to return a Promise:

```ts
import { throttle } from '@thingts/timing'

const throttled = throttle((x: number) => x * 2, 200)

const p1 = throttled(10)
const p2 = throttled(20)

console.log(await p1, await p2) // both print 20
```

---

## 🧰 TypeScript support

Both utilities are fully typed:

```ts
function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options?: {
    sequence?: 'serial' | 'concurrent' | 'gap'
  }
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options?: {
    edge?: 'leading' | 'trailing'
    sequence?: 'serial' | 'concurrent'
  }
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>
```

---

## ⚖️ Comparison to existing libraries

| Library | Async-safe? | Shared-Promise semantics? | Controls overlap? | Leading / trailing? |
|----------|-------------|---------------------------|-------------------|--------------------|
| `lodash.debounce` | ❌ | ❌ | ❌ | ✅ |
| `debounce-promise` | ✅ | ❌ (only last call’s promise resolves) | ❌ | ⚠️ partial |
| `p-throttle` | ✅ | ⚠️ (queues rather than coalesces) | ⚠️ partial | ❌ |
| **`@thingts/timing`** | ✅ | ✅ all coalesced calls share one Promise | ✅ via `sequence` | ✅ |

---

## 🧭 Usage summary

| Function | Executes | Spacing rule | Calls share Promise | Typical use |
|-----------|-----------|--------------|----------------------|--------------|
| **throttle** | on first call per period | depends on `sequence`: `'concurrent'`, `'serial'`, or `'gap'` | ✅ | rate-limiting periodic work |
| **debounce** | on first / last call (edge) | after last call + delay | ✅ | coalescing bursts of calls (noisy buttons, rapid typing) |

---

## 🪪 License

MIT © 2025 Ronen Barzel  
Part of the [**ThingTS**](https://github.com/thingts) toolkit — small, type-safe utilities for modern TypeScript projects.
