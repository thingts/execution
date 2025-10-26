import { describe, it, expect, vi } from 'vitest'
import { seqPromises, seqResults } from './helpers/seq'
import { sleep } from './helpers/sleep'
import { throttle } from '$src'

describe('throttle()', () => {

  it('fires immediately and returns the result', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(20)(fn)
    const p = thr(5)
    expect(fn).toHaveBeenCalledOnce()

    await expect(p).resolves.toEqual(5)
  })

  it('returns the SAME promise to all callers in the window', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(20)(fn)
    const promises = await seqPromises(thr, [0, 5, 10])

    const [p1, p2, p3] = promises
    expect(p1 === p2).toBe(true)
    expect(p2 === p3).toBe(true)

    await expect(Promise.all(promises)).resolves.toEqual([0, 0, 0])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(0)
  })

  it('returns new promise after window closed', async () => {
    const fn = vi.fn((x: number) => x)
    const thr = throttle(30)(fn)
    const promises = await seqPromises(thr, [0, 20, 40])

    const [p1, p2, p3] = promises
    expect(p1 === p2).toBe(true)
    expect(p2 === p3).toBe(false)

    await expect(Promise.all(promises)).resolves.toEqual([0, 0, 40])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rejects all callers if fn throws', async () => {
    let calls = 0
    const err = (): void => { calls++; throw new Error('boom') }
    const thr = throttle(10)(err)

    const p1 = thr()
    const p2 = thr()

    await expect(p1).rejects.toThrow('boom')
    await expect(p2).rejects.toThrow('boom')
    expect(calls).toEqual(1)
  })

  it('rejects all callers if fn rejects asynchronously', async () => {
    let calls = 0
    const err = async (): Promise<void> => { calls++; await sleep(10); throw new Error('nope') }
    const thr = throttle(10)(err)

    const p1 = thr()
    const p2 = thr()

    await expect(p1).rejects.toThrow('nope')
    await expect(p2).rejects.toThrow('nope')
    expect(calls).toBe(1)
  })

  it('works as a method decorator', async () => {

    class Example {
      @throttle(30)
      run(x: number): Promise<number> {
        return Promise.resolve(x)
      }
    }

    const ex = new Example()
    const results = await seqResults((x: number) => ex.run(x), [0, 20, 40])
    expect(results).toEqual([0, 0, 40])
  })

  describe('decorator form', () => {
    it('works with constant delay', async () => {
      class Example {
        @throttle(25)
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }

      const ex = new Example()
      const results = await seqResults((x: number) => ex.run(x), [0, 10, 30])
      expect(results).toEqual([0, 0, 30])
    })

    it('works with instance-specific delay', async () => {
      class Example {
        constructor(public delay: number) {}
        @throttle(function (this: Example) { return this.delay })
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }

      const ex = new Example(25)
      const results = await seqResults((x: number) => ex.run(x), [0, 10, 30])
      expect(results).toEqual([0, 0, 30])
    })

    it('isolates instance-specific delays', async () => {
      class Example {
        constructor(public delay: number) {}

        @throttle((self: Example) => self.delay)
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }
      const ex05 = new Example(5)
      const ex25 = new Example(25)

      // run throttled methods in parallel
      const [promises05, promises25] = await Promise.all([seqPromises((x: number) => ex05.run(x), [0, 10, 30]), seqPromises((x: number) => ex25.run(x), [0, 10, 30])])

      const results05 = await Promise.all(promises05)
      const results25 = await Promise.all(promises25)

      // each should have debounced correctly independently
      expect(results05).toEqual([0, 10, 30]) 
      expect(results25).toEqual([0, 0, 30])
    })
  })

  describe('long-running functions', () => {

    async function fn(arg: number): Promise<number> {
      await sleep(25)
      return arg
    }

    describe('sequence: serial', () => {
      it('waits for previous run to finish before starting the next', async () => {
        const thr = throttle(10, { sequence: 'serial' })(fn)

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

        const thr = throttle(10, { sequence: 'concurrent' })(fn)
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
        const thr = throttle(20, { sequence: 'gap' })(fn)

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
