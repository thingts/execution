/**
 * @internal
 * A type representing any function with any return type.
 */
export type AnyFunction<R = any> = (...args: readonly any[]) => R // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * @internal
 * Given a function type `F`, this is the type of a Promise that resolves
 * to the awaited return type of `F`.
 */
export type PromisifyReturn<F extends AnyFunction> = Promise<Awaited<ReturnType<F>>>

/**
 * Given a function `fn: T`, this is the shape of the the wrapped function:
 * - It has the same parameters as `fn`.
 * - It returns `fn`'s eventual value as a Promise.  That is: if `fn` returns a
 *   Promise, the new function returns the same type of Promise; if `fn`
 *   returns a non-Promise type, the new function returns a Promise
 *   resolving to that type.
 */
export type PromisifiedFunction<T extends AnyFunction> = (...args: Parameters<T>) => PromisifyReturn<T>

/**
 * A throttle delay specification: either a fixed number of milliseconds,
 * or a function that returns the number of milliseconds.  
 */
export type DelaySpec = number | ((self: any) => number) // eslint-disable-line @typescript-eslint/no-explicit-any
