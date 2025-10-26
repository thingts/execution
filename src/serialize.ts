import type { AnyFunction, PromisifiedFunction, PromisifyReturn } from './types'
import { getOrInsertComputed } from './map'

/** @internal
 *
 * The shape of a queue:  Given a function, it will return a promise that
 * will eventually resolve to the result of calling that function.
 */
type SerialQueue = <T>(fn: () => T | Promise<T>) => Promise<T>

/**
 * Allowed types for serialization groups passed to {@link SerializeOptions.group}
 */
export type SerializeGroupKey = string | number | boolean | symbol | bigint | object

/**
 * Options for {@link serialize}`({ ...opts })`
 */
export type SerializeOptions = {
  /**
   * Identifier for a serialization group (shared queue) to use.  If
   * omitted, each function or method that {@link serialize}() is applied
   * to is serialized only with itself.
   */
  group?: SerializeGroupKey
}

/**
 * The result of {@link serialize}() when used in functional form.
 *
 * It's a factory that takes a function and returns a serialized wrapper of it.
 *
 * @example
 *
 *   ```
 *   const s: Serializer = serialize({ group: 'net' })
 *   const fetchOnceAtATime = s(fetchFn)
 *   ```
 */
export type Serializer = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>

/**
 * Create a serializer to cause repeated async functions calls to be queued
 * for execution one at a time.
 *
 * By default, each serialized function is serialized in its own queue.
 * An optional `group` parameter allows multiple functions to share the
 * same serialization queue, keyed by an arbitrary value.
 *
 * When used as a method decorator, the queues are scoped to the object
 * instance, so that calls to methods on the same instance are serialized,
 * but calls on different object instances can run concurrently.
 *
 *
 * @example
 *
 * ```
 * // Basic functional form:
 * const oneAtATime = serialize()(async function fetchData(...) { ... })
 *
 * // With grouping:
 * const save = serialize({ group: 'db' })(saveToDb)
 * const load = serialize({ group: 'db' })(loadFromDb)
 *
 * // With serializer object:
 * const serializer: Serializer = serialize({ group: 'tasks' })
 * const task1 = serializer(async function task1(...) { ... })
 * const task2 = serializer(async function task2(...) { ... })
 *
 *
 * // Decorator form (ECMAScript / TypeScript 5.2+)
 * class Player {
 *   @serialize()
 *   async play() { ... }
 * }
 * ```
 */
export function serialize(opts: SerializeOptions = {}): Serializer {

  return function <F extends AnyFunction<unknown>>(fn: F, _context?: ClassMethodDecoratorContext): PromisifiedFunction<F> {

    const { group } = opts
    const anonymous = Symbol('AnonymousGroup')

    return async function (this: unknown, ...args: Parameters<F>): PromisifyReturn<F> {
      const map   = getOrInsertComputed(instanceMaps, this ?? globalThis, () => new Map<SerializeGroupKey, SerialQueue>())
      const queue = getOrInsertComputed(map, group ?? anonymous, () => createSerialQueue())
      return await queue(() => fn.apply(this, args)) as PromisifyReturn<F>
    }
  }
}

/** @internal
 * Map of instance-specific serialization queues
 * - WeakMap key:  object instance (or globalThis for plain functions)
 */
const instanceMaps = new WeakMap<object, Map<SerializeGroupKey, SerialQueue>>()

function createSerialQueue(): SerialQueue {
  let pending: Promise<unknown> = Promise.resolve()

  return function <T>(fn: () => T | Promise<T>): Promise<T> {
    const next = pending.catch(() => {}).then(fn)
    pending = next.finally(() => {})
    return next
  }
}
