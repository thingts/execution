import { sleep } from './sleep'

/*
 * Calls the throttled/debounced function `thr` at the specified times
 * and returns an array of the resulting promises.
 */
export async function seqPromises<T>(thr: (arg: number) => Promise<T>, callTimes: readonly number[]): Promise<Promise<T>[]> {
  const promises: Promise<T>[] = []
  await Promise.all(callTimes.map(t => sleep(t).then(() => promises.push(thr(t)))))
  return promises
}

/*
 * Calls the throttled/debounced function `thr` at the specified times
 * and returns an array of the resolved results.
 */
export async function seqResults<T>(thr: (arg: number) => Promise<T>, callTimes: readonly number[]): Promise<T[]> {
  return Promise.all(await seqPromises(thr, callTimes))
}
