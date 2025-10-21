import { beforeEach, describe, it, expect, vi } from 'vitest'
import { seqPromises, seqResults, sleep } from './helpers'
import { throttle } from '$src'

describe('throttle()', () => {

  it('fires immediately and returns the result', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(fn, 20)
    const p = thr(5)
    expect(fn).toHaveBeenCalledOnce()

    await expect(p).resolves.toBe(5)
  })

  it('returns the SAME promise to all callers in the window', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(fn, 20)
    const promises = await seqPromises(thr, [0, 5, 10])

    const [p1, p2, p3] = promises
    expect(p1).toBe(p2)
    expect(p2).toBe(p3)

    await expect(Promise.all(promises)).resolves.toEqual([0, 0, 0])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(0)
  })

  it('returns new promise after window closed', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(fn, 30)
    const promises = await seqPromises(thr, [0, 20, 40])

    const [p1, p2, p3] = promises
    expect(p1).toBe(p2)
    expect(p2).not.toBe(p3)

    await expect(Promise.all(promises)).resolves.toEqual([0, 0, 40])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rejects all callers if fn throws', async () => {
    let calls = 0
    const err = (): void => { calls++; throw new Error('boom') }
    const thr = throttle(err, 10)

    const p1 = thr()
    const p2 = thr()

    await expect(p1).rejects.toThrow('boom')
    await expect(p2).rejects.toThrow('boom')
    expect(calls).toBe(1)
  })

  it('rejects all callers if fn rejects asynchronously', async () => {
    let calls = 0
    const err = async (): Promise<void> => { calls++; await sleep(10); throw new Error('nope') }
    const thr = throttle(err, 10)

    const p1 = thr()
    const p2 = thr()

    await expect(p1).rejects.toThrow('nope')
    await expect(p2).rejects.toThrow('nope')
    expect(calls).toBe(1)
  })

  describe('async functions', () => {

    const timestamps: number[] = []

    async function fn(arg: number): Promise<number> {
      timestamps.push(performance.now())
      await sleep(25)
      return arg
    }

    beforeEach(() => {
      timestamps.length = 0
    })

    describe('sequence: serial', () => {
      it('waits for previous run to finish before starting the next', async () => {
        const thr = throttle(fn, 10, { sequence: 'serial' })

        const results = await seqResults(thr, [
          0,  // first call:  will resolve at 25
          5,  // second call -- still in window of first
          20, // third call -- throttle delay elapsed but window still open due to first call still running
          35, // fourth call -- throttle delay elapsed and previous call finished
        ])
        expect(results).toEqual([0, 0, 0, 35])
      })
    })

    describe('sequence: concurrent', () => {
      it('runs overlapping executions when previous run is still in progress', async () => {

        const thr = throttle(fn, 10, { sequence: 'concurrent' })
        const results = await seqResults(thr, [
          0, // first call: will resolve at 25
          5, // second call -- still in window of first
          20, // third call -- throttle delay elapsed, window closed; starts new run even though first is still running
          35, // fourth call -- throttle delay elapsed, window closed; starts new run
        ])
        expect(results).toEqual([0, 0, 20, 35])

      })
    })


    describe('sequence: gap', () => {
      it('coalesces calls during the enforced gap period with the previous promise', async () => {
        const thr = throttle(fn, 20, { sequence: 'gap' })

        const results = await seqResults(thr, [
          0, // first call: will resolve at 25; gap will end at 45
          30, // second call -- after first finished, but within gap period
          50, // third call -- after gap period: new run will resolve at 75, gap ends at 95
          60, // fourth call -- within window of third
          90, // fifth call -- after third finished, but within gap period
          100, // sixth call -- after gap period
        ])
        expect(results).toEqual([0, 0, 50, 50, 50, 100])
      })
    })
  })
  
})
