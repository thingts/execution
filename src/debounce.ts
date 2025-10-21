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

class DebounceWindow<R> {
  #edge: DebounceEdge
  #delay: number
  #sequence: DebounceSequence
  #onClose: () => void

  #timedOut = false
  #settled = false
  #timeoutId: ReturnType<typeof setTimeout> | null = null
  #deferred = Promise.withResolvers<R>()
  #fired = false
  #func: (() => Promise<R> | R) | null = null


  get promise(): Promise<R> {
    return this.#deferred.promise
  }

  constructor(opts: { edge: DebounceEdge, delay: number, sequence: DebounceSequence, onClose: () => void }) {
    const { edge, delay, sequence, onClose } = opts
    this.#edge = edge
    this.#delay = delay
    this.#sequence = sequence
    this.#onClose = onClose
  }

  plan(func: () => Promise<R> | R): void {
    const firstCall = this.#func == null
    this.bump()
    this.#func = func
    if (firstCall && this.#edge === 'leading') {
      void this.run()
    }
  }

  private bump(): void {
    this.#clearTimeout()
    this.#timeoutId = setTimeout(() => {
      this.#timeoutId = null
      this.#timedOut = true
      if (this.#edge === 'trailing') {
        void this.run()
      }
      this.#checkClose()
    }, this.#delay)
  }

  private async run(): Promise<void> {
    if (this.#fired) { return }
    this.#fired = true
    try {
      this.#deferred.resolve(await this.#func!())
    } catch (err) {
      this.#deferred.reject(err)
    } finally {
      this.#settled = true
      this.#checkClose()
    }
  }

  #clearTimeout(): void {       
    if (this.#timeoutId != null) {
      clearTimeout(this.#timeoutId)
      this.#timeoutId = null
    }
  }

  #checkClose(): void {
    if (this.#timedOut && (this.#sequence === 'concurrent' || this.#settled)) {
      this.#close()
    }
  }

  #close(): void {
    this.#clearTimeout()
    this.#onClose()
  }
}
