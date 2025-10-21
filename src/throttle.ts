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

export function throttle<T extends (...args: readonly any[]) => any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  fn: T,
  delay: number,
  options?: { sequence?: ThrottleSequence }
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  type R = Awaited<ReturnType<T>>
  type A = Parameters<T>

  const { sequence = 'serial' } = options ?? {}
  let win: ThrottleWindow<R> | null = null

  return (...args: A): Promise<R> => {
    win ??= new ThrottleWindow<R>({
      func: () => fn(...args), // eslint-disable-line @typescript-eslint/no-unsafe-return
      delay,
      sequence,
      onClose: () => { win = null }
    })

    return win.promise
  }
}

class ThrottleWindow<R> {
  #timedOut = false
  #settled  = false
  #deferred = Promise.withResolvers<R>()
  #onClose: () => void
  #sequence: 'serial' | 'concurrent' | 'gap'

  get promise(): Promise<R> {
    return this.#deferred.promise
  }

  constructor(opts: {
    func: (() => Promise<R> | R)
    delay: number
    sequence: 'serial' | 'concurrent' | 'gap'
    onClose: () => void
  }) {
    const { func, delay, sequence, onClose } = opts
    this.#onClose = onClose
    this.#sequence = sequence

    // For 'gap', we don't start the timer until the function settles.
    if (sequence !== 'gap') {
      this.#setTimeout(delay)
    }

    void this.#run(func, delay)
  }

  async #run(func: () => Promise<R> | R, delay: number): Promise<void> {
    try {
      this.#deferred.resolve(await func())
    } catch (err) {
      this.#deferred.reject(err)
    } finally {
      this.#settled = true
      if (this.#sequence === 'gap') {
        this.#setTimeout(delay)
      }
      this.#checkClose()
    }
  }

  #setTimeout(delay: number): void {
    setTimeout(() => {
      this.#timedOut = true
      this.#checkClose()
    }, delay)
  }


  #checkClose(): void {
    if (this.#timedOut && (this.#sequence === 'concurrent' || this.#settled)) {
      this.#onClose()
    }
  }
}
