/**
 * @internal
 *
 * Base class for the timing windows. 
 *
 * Provides the basic functionalities of setting the window timeout and
 * running a wrapped function at most once, and closing the window when
 * appropiate based on the sequence option.
 *
 * Subclasses must implement:
 * - onTimeout(): called when delay expires.
 * - onSettled(): called after the wrapped function resolves/rejects.
 *
 * The base handles:
 * - Managing a single deferred promise
 * - Timer cleanup
 * - Closing logic based on `sequence`
 */

export abstract class BaseTimingWindow<R> {
  protected timedOut = false
  protected settled  = false
  protected fired    = false
  #deferred          = Promise.withResolvers<R>()
  #timeoutId         = null as ReturnType<typeof setTimeout> | null

  constructor(
    protected readonly delay: number,
    protected readonly sequence: 'serial' | 'concurrent' | 'gap',
    protected readonly onClose: () => void
  ) {}

  get promise(): Promise<R> { return this.#deferred.promise }

  protected setTimeout(): void {
    this.clearTimeout()
    this.#timeoutId = setTimeout(() => {
      this.#timeoutId = null
      this.timedOut = true
      this.onTimeout()
      this.checkClose()
    }, this.delay)
  }

  protected clearTimeout(): void {
    if (this.#timeoutId != null) {
      clearTimeout(this.#timeoutId)
      this.#timeoutId = null
    }
  }

  protected async run(func: () => Promise<R> | R): Promise<void> {
    if (this.fired) { return }
    this.fired = true
    try {
      this.#deferred.resolve(await func())
    } catch (err) {
      this.#deferred.reject(err)
    } finally {
      this.settled = true
      this.onSettled()
      this.checkClose()
    }
  }

  protected checkClose(): void {
    if (this.timedOut && (this.sequence === 'concurrent' || this.settled)) {
      this.close()
    }
  }

  protected close(): void {
    this.clearTimeout()
    this.onClose()
  }

  protected abstract onTimeout(): void
  protected abstract onSettled(): void
}

