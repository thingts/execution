# @thingts/execution

[![npm version](https://img.shields.io/npm/v/@thingts/execution.svg)](https://www.npmjs.com/package/@thingts/execution)
[![docs](https://img.shields.io/badge/docs-typedoc-blue)](https://thingts.github.io/execution/)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/thingts/execution/ci.yml)](https://github.com/thingts/execution/actions/workflows/ci.yml)
[![GitHub License](https://img.shields.io/github/license/thingts/execution)](LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@thingts/execution)](https://bundlephobia.com/package/@thingts/execution)

Async-friendly debounce, throttle, and serialize function wrappers for modern TypeScript (5.2+)

All are designed for **async/await** and can be used in either **functional** or **decorator** form.

---

## Why?

Many existing libraries contain debounce, throttle, and sequencing
utilities, but most have legacy designs from the pre-async, pre-TypeScript
era.  

This package provides modern, ergonomic versions of these utilities that
are fully type-safe, designed to work seamlessly with async functions, and
support method decorator syntax.


## ✨ Features

- Fully **type-safe** — preserves parameter and return types
- Works seamlessly with **async functions and Promises**
- Supports **method decorator syntax** (`@debounce`, `@throttle`, `@serialize`)
- Lightweight and dependency-free

---

## 🚀 Installation

```bash
npm install @thingts/execution
```

---

## 🧩 Overview

| Utility     | Purpose                                        | Typical Use |
|--------------|-----------------------------------------------|--------------|
| `debounce`   | Coalesce bursts of calls into one execution   | UI events |
| `throttle`   | Limit execution rate to once per interval.    | Scroll, resize, polling, APIs |
| `serialize`  | Queue async calls to run one at a time.       | network or file I/O, HTML media controllers |

Each utility wraps the original function to provide a new function that
enforces the desired behavior, returning a Promise that resolves (or
rejects) with the eventual result of the original function.

For debounce and throttle wrappers, multiple calls that yield a single
execution all return the exact same promise.  Async functions whose
executions last longer than the debounce/throttle window are handled
naturally, with options to control the subtleties for different use cases.

All utilities can be used in two ways:

1. **Functional form**: Call the utility with options to get a wrapper
   factory, which you then call with your target function to get the final
   wrapped function.

2. **Method decorator form**: Use the utility as a decorator on a class
   method definition.  When calling the resulting wrapped method on
   separate instances, they are considered to be independent (i.e., each
   instance has its own timing/queue state).

---

## 🔧 Usage Examples

These are a quick overview of how to use the functions. For complete docs and options, see the [API Reference](https://thingts.github.io/execution).

### Debounce

```ts
import { debounce } from '@thingts/execution'

// functional form
const save = debounce(200)(async () => {
  console.log('Saving...')
})

// calls in quick succession merge into one
save()
save()
save() // only one save() executes

// decorator form
class Editor {
  @debounce(300)
  async autoSave(): Promise<void> {
    console.log('Auto-saving document...')
  }
}
```

See the [debounce API reference](https://thingts.github.io/execution/functions/debounce.html) for full options details.

---

### Throttle

```ts
import { throttle } from '@thingts/execution'

// functional form
const tick = throttle(1000)(async () => {
  console.log('Tick')
})

// called every 250ms → but runs once per second
setInterval(tick, 250)

// decorator form
class Player {
  @throttle(500)
  async move(direction: string): Promise<void> {
    console.log('Moving', direction)
  }
}
```

See the [throttle API reference](https://thingts.github.io/execution/functions/throttle.html) for full options details.

---

### Serialize

```ts
import { serialize } from '@thingts/execution'

// individual function
const fetchData = serialize()(async (url: string) => {
  console.log('Fetching', url)
})
await Promise.all([
  fetchData('https://api.example.com/data1'),
  fetchData('https://api.example.com/data2'),
  fetchData('https://api.example.com/data3'),
]) // calls are queued and run one after another

// shared serialization queue via group key
const read  = serialize({ group: 'fileIO' })(async () => readFile('data.json'))
const write = serialize({ group: 'fileIO' })(async () => writeFile('data.json', '...'))
await Promise.all([read(), write()]) // ...: write waits until read completes

// decorator form
class AudioEngine {
  @serialize()
  async playSample(id: string): Promise<void> {
    console.log('Playing', id)
  }
}
```

See the [serialize API
reference](https://thingts.github.io/execution/functions/serialize.html)
for full options details.

## Contributing

Contributions are welcome!

As usual: fork the repo, create a feature branch, and open a
pull request, with tests and docs for any new functionality.  Thanks!
