import type { AnyFunction, PromisifiedFunction } from './types'
import type { DelaySpec } from './types'
import { BaseTimingWindow } from './base-timing-window'
import { getOrInsertComputed } from './map'
import { resolveDelay } from './types'

/**
 * The result of {@link debounce}() when used in functional form.
 *
 * It's a factory that takes a function and returns a debounced wrapper of it.
 *
 * @example
 *
 *   ```
 *   const d: Debouncer = debounce(200)
 *   const onClick = d(saveToDb)
 *   ```
 */
export type Debouncer = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>


export type DebounceEdge    = 'leading' | 'trailing'
export type DebounceSequence = 'concurrent' | 'serial'

export type DebounceOptions = {
  edge?:     DebounceEdge      // default: 'trailing'
  sequence?: DebounceSequence // default: 'serial'
}

/**
 * Returns a debounced version of the given function that delays execution
 * until after `delay` milliseconds have passed since the last call.  The
 * new function always returns a Promise; if the original function is
 * synchronous, its return value is wrapped in a Promise.
 *
 * All calls made within the debounce window return the exact same Promise,
 * that resolves (or rejects) with the value returned (or error thrown) by
 * the original function when it is invoked.
 *
 * Options:
 *
 * - `edge`: 'leading' | 'trailing' (default: 'trailing') - whether to call
 *   the function at the start or end of the debounce window.
 *
 * - `sequence`: 'concurrent' | 'serial' (default: 'serial') - controls
 *   when to close the debounce window after the function is called; this
 *   is only relevant when the function takes longer to compute than the
 *   debounce delay.
 *   - 'concurrent': when the debounce delay expires, the window is closed.
 *      Any calls after that will start a new debounce window and a new
 *      call to the function, returning a new promise.
 *   - 'serial': the window remains open until the function settles; any
 *     calls in the meantime return the same promise
 */

export function debounce(delay: DelaySpec, opts?: DebounceOptions): Debouncer {
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
