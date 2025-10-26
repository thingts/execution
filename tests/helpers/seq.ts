import { sleep } from './sleep'

/*
 * Calls the throttled/debounced function `thr` at the specified times
 * and returns an array of the resulting promises.
 */
export async function seqPromises(thr: (arg: number) => Promise<number>, callTimes: readonly number[]): Promise<Promise<number>[]> {
  const promises: Promise<number>[] = []
  await Promise.all(callTimes.map(t => sleep(t).then(() => promises.push(thr(t)))))
  return promises
}

/*
 * Calls the throttled/debounced function `thr` at the specified times
 * and returns an array of the resolved results.
 */
export async function seqResults(thr: (arg: number) => Promise<number>, callTimes: readonly number[]): Promise<number[]> {
  return Promise.all(await seqPromises(thr, callTimes))
}
