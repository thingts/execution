import type { AnyFunction, PromisifiedFunction } from './types'
import type { DelaySpec } from './types'
import { BaseTimingWindow } from './base-timing-window'
import { getOrInsertComputed, resolveDelay } from './util'

/** The return type of {@link debounce}() */
export type Debouncer = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>


/** The value type of the `edge` option of {@link debounce}() */
export type DebounceEdge    = 'leading' | 'trailing'

/** The value type of the `sequence` option of {@link debounce}() */
export type DebounceSequence = 'concurrent' | 'serial'

/** The options type of {@link debounce}() */
export type DebounceOptions = {
  edge?:     DebounceEdge
  sequence?: DebounceSequence
}

/**
 * Creates a debouncer that wraps a given function `fn` to produce a
 * debounced version.   The debounced version ensures that when invoked
 * multiple times in a burst close together in time, only a single call to
 * `fn` is made.
 *
 * Debouncing works by creating a window that closes when no calls have
 * been made for `delay` milliseconds.  The original function is invoked
 * only once during that window, either at the start or end of the window.
 *
 * The debounced function always returns a Promise.  All calls made within
 * the debounce window return the exact same Promise, that resolves (or
 * rejects) with the value returned (or error thrown) by the original
 * function when it is invoked and awaited.
 *
 * In functional form, if the same debouncer is applied to multiple
 * functions, each function is debounced independently.
 *
 * In method decorator form, calls to the method on different instances are
 * debounced independently.
 *
 * @example
 *
 *  ```
 *  import { debounce } from '@thingts/execution'
 *
 *  // Basic functional form:
 *  const saveOnce = debounce(200)(async function saveData(...) { ... })
 *
 *  // With a debouncer object
 *  const debouncer = debounce(200)
 *  const onClickSave = debouncer(function handleSave(...) { ... })
 *  const onClickLoad = debouncer(function handleLoad(...) { ... })
 *
 *  // As a method decorator
 *  class SearchBox {
 *    @debounce(300, { edge: 'leading' })
 *    async onInputChange(...) { ... }
 *  }
 *
 *  // With dynamic delay
 *  class AutoSaver {
 *     @debounce((self: AutoSaver) =>  self.getSaveDelay())
 *     async autoSave(...) { ... }
 *  }
 *  ```
 */

export function debounce(
  /** The debounce delay in milliseconds, or a function that returns it.
   * When {@link debounce} used as a method decorator, the function is passed the object
   * instance as its first (only) parameter. */
  delay: DelaySpec,

  /**
   * ```
   * {
   *    edge?:     'trailing' | 'leading'   // default: 'trailing'
   *    sequence?: 'serial' | 'concurrent'  // default: 'serial'
   * }
   * ```
   * * `'edge` Specifies when the debounced function is invoked:
   *   - `'leading'` - immediately at the first call, using its parameters.
   *   - `'trailing'` - after the debounce window timeout, using the parameters of the last call.
   *
   * * `sequence` determines behavior if the function is still executing when a fresh call is made:
   *    - `'serial'` - the window is kept open until the function finishes executing; the new call returns the same Promise as the ongoing call.
   *    - `'concurrent'` - allow overlapping execution; a new independent debounce window is opened, while the ongoing call continues to execute.
   */
  opts?: DebounceOptions
): Debouncer {
  const windowMap = new WeakMap<object, DebounceWindow<any>>() // eslint-disable-line @typescript-eslint/no-explicit-any

  return function <F extends AnyFunction>(fn: F, _context?: ClassMethodDecoratorContext): PromisifiedFunction<F> {
    type R = Awaited<ReturnType<F>>
    type A = Parameters<F>

    const { edge = 'trailing', sequence = 'serial'} = opts ?? {}
    const fallback = Symbol()

    return async function (this: unknown, ...args: A): Promise<R> {
      const key = this ?? fallback
      const win = getOrInsertComputed(windowMap, key, () => new DebounceWindow<R>({
        delay:   resolveDelay(this, delay),
        edge,
        sequence,
        onClose: () => windowMap.delete(key),
      })) as DebounceWindow<R>
      win.plan(() => fn.apply(this, args)) // eslint-disable-line @typescript-eslint/no-unsafe-return
      return win.promise
    }
  }
}


class DebounceWindow<R> extends BaseTimingWindow<R> {
  #edge: DebounceEdge
  #func: AnyFunction<R | Promise<R>> | null = null

  constructor(opts: { edge: DebounceEdge, delay: number, sequence: DebounceSequence, onClose: () => void }) {
    const { edge, delay, sequence, onClose } = opts
    super(delay, sequence, onClose)
    this.#edge = edge
  }

  plan(func: () => Promise<R> | R): void {
    const firstCall = this.#func == null
    this.#func = func
    this.setTimeout()
    if (firstCall && this.#edge === 'leading') {
      void this.run(this.#func)
    }
  }

  protected override onTimeout(): void {
    if (this.#edge === 'trailing') {
      void this.run(this.#func!)
    }
  }

  protected override onSettled(): void {
    // nothing to do
  }

}
