import type { AnyFunction, PromisifiedFunction } from './types'
import type { DelaySpec } from './types'
import { BaseTimingWindow } from './base-timing-window'
import { getOrInsertComputed } from './map'
import { resolveDelay } from './types'

/**
 * The result of {@link debounce}() when used in functional form.
 *
 * It's a factory that takes a function and returns a debounced wrapper of
 * it.  The same factory may be applied to multiple functions, each of
 * which will be debounced independently.
 *
 * @example
 *
 *   ```
 *   const d: Debouncer = debounce(200)
 *   const onClick = d(saveToDb)
 *   ```
 */
export type Debouncer = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>


/**
 * The value of the {@link DebounceOptions.edge} option of {@link debounce}().
 *
 * Specifies when the debounced function is invoked
 *   - `'leading'` - at the beginning of the debounce window
 *   - `'trailing'` - at the end (timeout) of the debounce window (default)
 *
 */
export type DebounceEdge    = 'leading' | 'trailing'

/**
 * The value of the {@link DebounceOptions.sequence} option of {@link debounce}().
 *
 * Specifies how debouncing behaves while the debounced function is still
 * executing
 *  - `'concurrent'` - the debounce window closes when the delay expires,
 *  and any calls after that start a new window and a new function call,
 *  concurrently with the previous one.
 * - `'serial'` - the debounce window remains open until the function
 *   resolves; any calls in the meantime return the same Promise.
 */
export type DebounceSequence = 'concurrent' | 'serial'

/**
 * Options for {@link debounce}().
 */
export type DebounceOptions = {
  /** Specifies when to invoke the debounced function.  See {@link DebounceEdge } */
  edge?:     DebounceEdge      // default: 'trailing'

  /** Specifies how to handle calls while the function is still executing.  See {@link DebounceSequence} */
  sequence?: DebounceSequence // default: 'serial'
}

/**
 * Creates a debouncer with the given delay and options.  Can be used both
 * as a method deocrator and in functional form.
 *
 * Debouncing works by creating a window that closes only when no calls
 * have been made for `delay` milliseconds.  The function is invoked only
 * once during that window, either at the start or end of the window.  The
 * net effect is that multiple calls to the debounced function that are
 * close together are treated as a single call.
 *
 * The debounced function always returns a Promise.  All calls made within
 * the debounce window return the exact same Promise, that resolves (or
 * rejects) with the value returned (or error thrown) by the original
 * function when it is invoked and awaited.
 *
 * In functional form, if the same debouncer is applied to multiple
 * functions, each function is debounced independently.
 *
 * @parameters:
 *   - `delay`:   The debounce delay in milliseconds, a function that
 *     returns the delay.  If used as a method decorator, the function is
 *     passed the object instance.
 *   - `opts`:    See {@link DebounceOptions}, and {@link DebounceEdge}, {@link
 * DebounceSequence}
 *
 * @examples:
 *
 *  ```
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
  /** See {@link DebounceOptions} */
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
