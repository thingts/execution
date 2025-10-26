export type AnyFunction<R = any> = (...args: readonly any[]) => R // eslint-disable-line @typescript-eslint/no-explicit-any

export type PromisifyReturn<F extends AnyFunction> = Promise<Awaited<ReturnType<F>>>

/**
 * Given a function `fn: T`, this is the shape of the function returned by {@link
 * serialize}`(fn: T)`
 *
 * - It has the same params
 * - It always returns a Promise of T's awaited return type
 */
export type PromisifiedFunction<T extends AnyFunction> = (...args: Parameters<T>) => PromisifyReturn<T>

export type DelaySpec = number | ((self: any) => number) // eslint-disable-line @typescript-eslint/no-explicit-any

export function resolveDelay(thisArg: unknown, delay: DelaySpec): number {
  return typeof delay === 'function' ? delay.apply(thisArg, [thisArg]) : delay
}
