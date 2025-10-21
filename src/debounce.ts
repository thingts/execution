import { BaseTimingWindow } from './base-timing-window'

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

export function debounce<T extends (...args: readonly any[]) => any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  fn:    T,
  delay: number,
  opts?: DebounceOptions,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const { edge = 'trailing', sequence = 'serial'} = opts ?? {}

  type R = Awaited<ReturnType<T>>
  type A = Parameters<T>

  let win: DebounceWindow<R> | null = null

  return (...args: A): Promise<R> => {

    win ??= new DebounceWindow<R>({ edge, delay, sequence, onClose: () => { win = null } })
    win.plan(() => fn(...args)) // eslint-disable-line @typescript-eslint/no-unsafe-return
    return win.promise
  }
}

class DebounceWindow<R> extends BaseTimingWindow<R> {
  #edge: DebounceEdge
  #func: (() => Promise<R> | R) | null = null

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
