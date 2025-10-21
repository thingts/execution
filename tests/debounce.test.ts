import { debounce } from '$src'
import { describe, it, expect, vi } from 'vitest'
import { seqResults, sleep } from './helpers'

describe('debounce()', () => {
  it('delays execution and resolves to the result', async () => {
    const fn = vi.fn((x: number) => x * 2)
    const debounced = debounce(fn, 50)

    const promise = debounced(5)
    expect(fn).not.toHaveBeenCalled()

    await expect(promise).resolves.toBe(10)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('resolves all callers with the same result', async () => {
    const fn = vi.fn((x: number) => x)
    const debounced = debounce(fn, 20)
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
    const debounced = debounce(fn, 30)
    const results = await seqResults(debounced, [1, 2])
    expect(results).toEqual([2, 2])
  })

  it('rejects all callers if fn throws', async () => {
    let count = 0
    const fn = (): void => {
      count++
      throw new Error('fail')
    }
    const debounced = debounce(fn, 10)


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
    const debounced = debounce(fn, 10)

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
    const debounced = debounce(fn, 20)
    const results = await seqResults(debounced, [0, 10, 20])
    expect(results).toEqual([20, 20, 20])
  })

  describe('options combinations', () => {

    it('leading + serial: burst joins immediate run, late joiners after deadline join same result', async () => {
      const fn = (x: number): Promise<number> => sleep(35).then(() => x)
      const deb = debounce(fn, 15, { edge: 'leading', sequence: 'serial' })
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
      const deb = debounce(fn, 15, { edge: 'trailing', sequence: 'serial' })
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
      const deb = debounce(fn, 15, { edge: 'leading', sequence: 'concurrent' })
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
      const deb = debounce(fn, 15, { edge: 'trailing', sequence: 'concurrent' })
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
