type AnyFunction = (...args: readonly any[]) => unknown // eslint-disable-line @typescript-eslint/no-explicit-any
type PromisifyReturn<F extends AnyFunction> = Promise<Awaited<ReturnType<F>>>

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
   * omitted, each call to {@link serialize}() creates a unique anonymous
   * group
   */
  group?: SerializeGroupKey

  /**
   * If true, serialization groups are scoped per instance, i.e. multiple
   * calls to a method on the same instance are serialized, but calls to
   * the same method on different instances can run conncurrently.
   *
   * If combined with `group`, similarly creates the shared group per instance.
   */
  perInstance?: boolean
}


/**
 * Given a function `fn: T`, this is the shape of the function returned by {@link
 * serialize}`(fn: T)`
 *
 * - It has the same params
 * - It always returns a Promise of T's awaited return type
 */
export type SerializedFunction<T extends AnyFunction> = (...args: Parameters<T>) => PromisifyReturn<T>


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
export type Serializer = <T extends AnyFunction>(fn: T) => SerializedFunction<T>

/**
 * Create a serializer to cause repeated async functions calls to be queued
 * for execution one at a time.
 *
 * By default, each call to `serialize()` creates a new independent queue.
 * An optional `group` parameter allows multiple functions to share the
 * same serialization queue.
 *
 * When used as a method decorator with `perInstance: true`, the queues are
 * scoped to the object instance, so that calls to methods on the same
 * instance are serialized, but calls on different object instances can run
 * concurrently.
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
 * const serializer: Serializer = serialize()
 * const task1 = serializer(async function task1(...) { ... })
 * const task2 = serializer(async function task2(...) { ... })
 *
 *
 * // Decorator form (ECMAScript / TypeScript 5.2+)
 * class Player {
 *   @serialize({ perInstance: true })
 *   async play() { ... }
 * }
 * ```
 */
export function serialize(opts: SerializeOptions = {}): Serializer {
  return function <F extends AnyFunction>(fn: F, _context?: ClassMethodDecoratorContext): SerializedFunction<F> {

    const { perInstance = false, group } = opts

    if (perInstance) {
      // for the per-instance case, a map of queues is stored in a WeakMap
      // keyed by `this`; if no group is specified, use a unique symbol to
      // key the instance-wide shared "global" queue in that map
      const groupKey = group ?? Symbol('IndividualPerInstance')
      return async function (this: object, ...args: Parameters<F>): PromisifyReturn<F> {
        const map   = getOrInsertComputed(instanceMaps, this, () => new Map<SerializeGroupKey, SerialQueue>())
        const queue = getOrInsertComputed(map, groupKey, () => createSerialQueue())
        return queue(() => fn.apply(this, args)) as PromisifyReturn<F>
      }
    } else {
      // for the global case, if no group is specified, create a new queue
      // each time.  Don't insert it in the global map, so it can be GC'd
      // if the wrapped function is GC'd.
      const queue = group !== undefined ? getOrInsertComputed(globalGroups, group, () => createSerialQueue()) : createSerialQueue()
      return async function (this: object, ...args: Parameters<F>): PromisifyReturn<F> {
        return queue(() => fn.apply(this, args)) as PromisifyReturn<F>
      }
    }
  }
}

type SerialQueue = <T>(fn: () => T | Promise<T>) => Promise<T>
const globalGroups = new Map<SerializeGroupKey, SerialQueue>()
const instanceMaps = new WeakMap<object, Map<SerializeGroupKey, SerialQueue>>()

function createSerialQueue(): SerialQueue {
  let pending: Promise<unknown> = Promise.resolve()

  return function <T>(fn: () => T | Promise<T>): Promise<T> {
    const next = pending.catch(() => {}).then(fn)
    pending = next.finally(() => {})
    return next
  }
}


function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, compute: () => V): V
function getOrInsertComputed<K extends WeakKey, V>(map: WeakMap<K, V>, key: K, compute: () => V): V
function getOrInsertComputed<K extends WeakKey, V>(map: Map<K, V> | WeakMap<K, V>, key: K, compute: () => V): V {
  let val = map.get(key)
  if (val === undefined) {
    val = compute()
    map.set(key, val)
  }
  return val
}
