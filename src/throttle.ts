import type { AnyFunction, PromisifiedFunction } from './types'
import type { DelaySpec } from './types'
import { getOrInsertComputed, resolveDelay } from './util'
import { BaseTimingWindow } from './base-timing-window'

/** The return type of {@link throttle}() */
export type Throttler = <T extends AnyFunction>(fn: T) => PromisifiedFunction<T>


/** The value type of the `sequence` option of {@link throttle}() */
export type ThrottleSequence = 'concurrent' | 'serial' | 'gap'

/**
 * Creates a throttler that wraps a given function `fn` to produce a
 * throttled version.  The throttled version ensures that when invoked
 * repeatedly, `fn` is called at most once every `delay` milliseconds.
 *
 * Throttling works by creating a window that closes after `delay`
 * milliseconds. All calls made within the throttle window return the exact
 * same Promise, that resolves (or rejects) with the value returned (or
 * error thrown) by invoking and awaiting the original function.
 *
 * @example
 *
 * ```
 * import { throttle } from '@thingts/execution'
 *
 * // Basic functional form:
 * const updateThrottled = throttle(200, { sequence: 'gap' })(async function update(...) { ... })
 *
 * // With a throttler object
 * const throttler = throttle(200)
 * const onScroll = throttler(function handleScroll(...) { ... })
 * const onResize = throttler(function handleResize(...) { ... })
 *
 * // As a method decorator
 * class EditWindow {
 *   @throttle(300)
 *   async onScroll(...) { ... }
 *   }
 * }
 *
 * // With dynamic delay
 * class ApiClient {
 *   private rateLimitMs = 500
 *
 *   @throttle((self: ApiClient) => return self.rateLimitMs)
 *   async fetchData(...) { ... }
 * }
 * ```
 *
 */

export function throttle(
  /** The throttle delay in milliseconds, or a function that returns it.
   * When {@link throttle} used as a method decorator, the function is passed the object
   * instance as its first (only) parameter. */
  delay: DelaySpec,

  /**
   * - `sequence`:  How to handle long-running executions:
   *   - `'serial'`: (default) keep the window open until the execution settles.  Once it finishes, a new call can start a new window immediately. (Maximum throughput, up to the throttle delay.)
   *   - `'gap'`: keep the window open until delay milliseconds after the execution settles.  Once that delay expires a new call can start a new window. (Fixed minimum delay between calls.)
   *   - `'concurrent'`: allow overlapping execution; a new call may start once the delay expires, even if the previous is still executing.
   */
  options?: { sequence?: ThrottleSequence },
): Throttler {

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
