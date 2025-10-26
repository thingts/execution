import { debounce } from '$src'
import { describe, it, expect, vi } from 'vitest'
import { seqPromises, seqResults } from './helpers/seq'
import { sleep } from './helpers/sleep'

describe('debounce()', () => {
  it('delays execution and resolves to the result', async () => {
    const fn = vi.fn((x: number) => x * 2)
    const debounced = debounce(50)(fn)

    const promise = debounced(5)
    expect(fn).not.toHaveBeenCalled()

    await expect(promise).resolves.toBe(10)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('resolves all callers with the same result', async () => {
    const fn = vi.fn((x: number) => x)
    const debounced = debounce(20)(fn)
    const results = await seqResults(debounced, [0, 2, 4])
    expect(results).toEqual([4, 4, 4])

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith(4)
  })

  it('handles async functions and awaits them', async () => {
    const fn = vi.fn(async (x: number) => {
      await sleep(10)
      return x
    })
    const debounced = debounce(30)(fn)
    const results = await seqResults(debounced, [1, 2])
    expect(results).toEqual([2, 2])
  })

  it('rejects all callers if fn throws', async () => {
    let count = 0
    const fn = (): void => {
      count++
      throw new Error('fail')
    }
    const debounced = debounce(10)(fn)


    const p1 = debounced()
    const p2 = debounced()

    await expect(p1).rejects.toThrow('fail')
    await expect(p2).rejects.toThrow('fail')
    expect(count).toBe(1)
  })

  it('rejects all callers if fn is async and rejects', async () => {
    let count = 0
    const fn = async (): Promise<void> => {
      await sleep(5)
      count++
      throw new Error('async fail')
    }
    const debounced = debounce(10)(fn)

    const p1 = debounced()
    const p2 = debounced()

    await expect(p1).rejects.toThrow('async fail')
    await expect(p2).rejects.toThrow('async fail')
    expect(count).toBe(1)
  })

  it('debounces properly across rapid calls', async () => {
    const calls: number[] = []
    const fn = (x: number): number  => {
      calls.push(x)
      return x
    }
    const debounced = debounce(20)(fn)
    const results = await seqResults(debounced, [0, 10, 20])
    expect(results).toEqual([20, 20, 20])
  })

  it('debounces different functions independently', async () => {
    const fnA = vi.fn((x: number) => `A${String(x)}`)
    const fnB = vi.fn((x: number) => `B${String(x)}`)
    const d = debounce(20)

    const dbA = d(fnA)
    const dbB = d(fnB)

    const [promisesA, promisesB] = await Promise.all([seqPromises(dbA, [0, 10, 20]), seqPromises(dbB, [0, 10, 20])])

    const resultsA = await Promise.all(promisesA)
    const resultsB = await Promise.all(promisesB)

    expect(resultsA).toEqual(['A20', 'A20', 'A20'])
    expect(resultsB).toEqual(['B20', 'B20', 'B20'])
  })

  describe('decorator form', () => {
    it('works with constant delay', async () => {
      class Example {
        @debounce(20)
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }
      const ex = new Example()
      const results = await seqResults((x: number) => ex.run(x), [0, 10, 20])
      expect(results).toEqual([20, 20, 20])
    })

    it('works with instance-specific delay', async () => {
      class Example {
        constructor(public delay: number) {}

        @debounce((self: Example) => self.delay)
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }
      const ex = new Example(20)
      const results = await seqResults((x: number) => ex.run(x), [0, 10, 20])
      expect(results).toEqual([20, 20, 20])
    })

    it('isolates instance-specific delays', async () => {
      class Example {
        constructor(public delay: number) {}

        @debounce((self: Example) => self.delay)
        run(x: number): Promise<number> {
          return Promise.resolve(x)
        }
      }
      const ex05 = new Example(5)
      const ex20 = new Example(20)

      // run debounced methods in parallel
      const [promises05, promises20] = await Promise.all([seqPromises((x: number) => ex05.run(x), [0, 10, 20]), seqPromises((x: number) => ex20.run(x), [0, 10, 20])])

      const results05 = await Promise.all(promises05)
      const results20 = await Promise.all(promises20)

      // each should have debounced correctly independently
      expect(results05).toEqual([0, 10, 20]) 
      expect(results20).toEqual([20, 20, 20])
    })
  })

  describe('options combinations', () => {

    it('leading + serial: burst joins immediate run, late joiners after deadline join same result', async () => {
      const fn = (x: number): Promise<number> => sleep(35).then(() => x)
      const deb = debounce(15, { edge: 'leading', sequence: 'serial' })(fn)
      const results = await seqResults(deb, [
        0, // first call: starts run, bumps window to 15, resolves at 35
        10, // second call: joins first run, bumps window to 25
        30, // third call: after deadline but before run settled, joins run, bumps window to 45
        50  // fourth call: after window closed, starts new run
      ])
      expect(results).toEqual([0, 0, 0, 50])
    })

    it('trailing + serial: burst joins immediate run, late joiners after deadline join same result', async () => {
      const fn = (x: number): Promise<number> => sleep(35).then(() => x)
      const deb = debounce(15, { edge: 'trailing', sequence: 'serial' })(fn)
      const results = await seqResults(deb, [
        0, // first call: bumps window to 15
        10, // second call: bumps window to 25
         // ... timeout at 25, starts run, resolves at 60
        50, // third call: after deadline but before run settled, joins run, bumps window to 65
        70  // fourth call: after window closed, starts new run
      ])
      expect(results).toEqual([10, 10, 10, 70])
    })

    it('leading + concurrent: next call after deadline creates new run', async () => {
      const fn = (x: number): Promise<number> => sleep(35).then(() => x)
      const deb = debounce(15, { edge: 'leading', sequence: 'concurrent' })(fn)
      const results = await seqResults(deb, [
        0,  // first call: starts run, bumps window to 15, resolves at 35
        10, // second call: joins first run, bumps deadline to 25
        30, // third call: after deadline, starts new run, new window closes at 45 (run resolves at 65)
        50, // fourth call: after deadline, starts new run
      ])
      expect(results).toEqual([0, 0, 30, 50])
    })

    it('trailing + concurrent: next call after deadline creates new run', async () => {
      const fn = (x: number): Promise<number> => sleep(35).then(() => x)
      const deb = debounce(15, { edge: 'trailing', sequence: 'concurrent' })(fn)
      const results = await seqResults(deb, [
        0,  // first call: bumps window to 15
        10, // second call: bumps window to 25
         // ... timeout at 25, starts run, resolves at 60
        30, // third call: after deadline, starts new run, new window closes at 45 (run resolves at 65)
        50, // fourth call: after deadline, starts new run
      ])
      expect(results).toEqual([10, 10, 30, 50])
    })

  })

})
