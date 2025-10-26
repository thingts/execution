import type { AnyFunction, PromisifiedFunction } from './types'
import type { DelaySpec } from './types'
import { getOrInsertComputed } from './map'
import { resolveDelay } from './types'
import { BaseTimingWindow } from './base-timing-window'

/**
 * The result of {@link throttle}() when used in functional form.
 *
 * It's a factory that takes a function and returns a throttled wrapper of it.
 *
 * @example
 *
 *   ```
 *   const th: Throttler = throttle(100)
 *   const onScroll = th(updateScroll)
 *   ```
 */
export type Throttler = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>

export type ThrottleSequence = 'concurrent' | 'serial' | 'gap'

/**
 * Returns a throttled version of `fn` that, when invoked multiple times,
 * calls `fn` at most once every `delay` milliseconds.  The throttled
 * function always returns a Promise; if the original function is
 * synchronous, its return value is wrapped in a Promise.
 *
 * All calls made during the current throttle period return the same Promise,
 * which resolves or rejects with the result of the single execution.
 *
 * The `sequence` option controls how overlapping or long-running executions
 * are handled:
 *
 * - `'serial'` (default): wait for the previous run to finish before starting
 *   a new one, but do not enforce an additional idle gap.
 * - `'concurrent'`: allow overlapping runs; the next may start once the delay
 *   expires, even if the previous run is still running.
 * - `'gap'`: wait for the previous run to finish, then wait at least `delay`
 *   ms before starting another.
 */

export function throttle(delay: DelaySpec, options?: { sequence?: ThrottleSequence }): Throttler {
  const windowMap = new WeakMap<object, ThrottleWindow<any>>() // eslint-disable-line @typescript-eslint/no-explicit-any

  return function <F extends AnyFunction>(fn: F, _context?: ClassMethodDecoratorContext): PromisifiedFunction<F> {
    type R = Awaited<ReturnType<F>>
    type A = Parameters<F>

    const { sequence = 'serial' } = options ?? {}
    const fallback = Symbol()

    return function (this: unknown, ...args: A): Promise<R> {
      const key = this ?? fallback
      const win = getOrInsertComputed(windowMap, key, () => new ThrottleWindow<R>({
        func:    () => fn(...args), // eslint-disable-line @typescript-eslint/no-unsafe-return
        delay:   resolveDelay(this, delay),
        sequence,
        onClose: () => windowMap.delete(key),
      }))
      return win.promise
    }
  }
}

class ThrottleWindow<R> extends BaseTimingWindow<R> {

  constructor(opts: {
    func: (() => Promise<R> | R)
    delay: number
    sequence: 'serial' | 'concurrent' | 'gap'
    onClose: () => void
  }) {
    const { func, delay, sequence, onClose } = opts
    super(delay, sequence, onClose)

    // For 'gap', we don't start the timer until the function settles.
    if (sequence !== 'gap') { this.setTimeout() }

    void this.run(func)
  }

  protected override onTimeout(): void {
    // nothing to do
  }

  protected override onSettled(): void {
    if (this.sequence === 'gap') {
      this.setTimeout()
    }
  }
}
