import { beforeEach, describe, it, expect } from 'vitest'
import { serialize } from '$src'
import { makeRecorder, makeFunc } from './helpers/concurrency'

describe('serialize', () => {
  let rec: ReturnType<typeof makeRecorder>

  beforeEach(() => {
    rec = makeRecorder()
  })

  describe('functional form', () => {
    it('serializes sequentially by default', async () => {
      const f = serialize()(makeFunc(rec, 'f', 10))

      await Promise.all([f(1), f(2), f(3)])
      // should have run strictly one at a time
      expect(rec.maxConcurrency()).toBe(1)
      expect(rec.results).toEqual(['f:1', 'f:2', 'f:3'])
    })

    it('shares a group across multiple functions', async () => {
      const group = {}
      const s = serialize({ group })
      const f1 = s(makeFunc(rec, 'f1', 10))
      const f2 = s(makeFunc(rec, 'f2', 10))

      await Promise.all([f1('A'), f2('B'), f1('C')])

      // all in same group, so concurrency 1 overall
      expect(rec.maxConcurrency()).toBe(1)
      // order of entry should reflect sequential execution
      expect(rec.results).toEqual(['f1:A', 'f2:B', 'f1:C'])
    })

    it('isolates different groups (run in parallel)', async () => {
      const fA = serialize({ group: 'A' })(makeFunc(rec, 'A', 30))
      const fB = serialize({ group: 'B' })(makeFunc(rec, 'B', 10))

      await Promise.all([fA(1), fB(2), fA(3)])

      // A’s queue sequential, B’s independent
      expect(rec.maxConcurrency('A')).toBe(1)
      expect(rec.maxConcurrency()).toBe(2)
      expect(rec.results).toEqual(['B:2', 'A:1', 'A:3'])
    })

    it('independent serialize() calls have separate queues', async () => {
      const f1 = serialize()(makeFunc(rec, 'f1', 30))
      const f2 = serialize()(makeFunc(rec, 'f2', 10))

      await Promise.all([f1('A'), f2('B')])
      expect(rec.maxConcurrency()).toBe(2)
      expect(rec.results).toEqual(['f2:B', 'f1:A'])
    })
  })

  describe('decorator form', () => {
    it('serializes globally by default', async () => {

      class Example {
        constructor(readonly label: string) {}

        @serialize()
        async run(x: string): Promise<void> { await makeFunc(rec, this.label, 10)(x) }
      }

      const a = new Example('A')
      const b = new Example('B')
      await Promise.all([a.run('1'), a.run('2'), b.run('3'), b.run('4')])

      expect(rec.results).toEqual(['A:1', 'A:2', 'B:3', 'B:4'])
      expect(rec.maxConcurrency('A')).toBe(1)
      expect(rec.maxConcurrency('B')).toBe(1)
      expect(rec.maxConcurrency()).toBe(1)
    })

    it('serializes per instance when perInstance:true', async () => {

      class Example {
        constructor(readonly label: string) {}

        @serialize({ perInstance: true })
        async run(x: string): Promise<void> { await makeFunc(rec, this.label, 10)(x) }
      }

      const a = new Example('A')
      const b = new Example('B')
      await Promise.all([a.run('1'), a.run('2'), b.run('3'), b.run('4')])

      expect(rec.results).toEqual(['A:1', 'B:3', 'A:2', 'B:4'])
      expect(rec.maxConcurrency('A')).toBe(1)
      expect(rec.maxConcurrency('B')).toBe(1)
      expect(rec.maxConcurrency()).toBe(2)
    })

    it('supports perInstance + group subgrouping', async () => {

      class Example {
        @serialize({ perInstance: true, group: 'alpha' })
        async alphaOne(x: string): Promise<void> { await makeFunc(rec, 'alpha', 10)(x) }

        @serialize({ perInstance: true, group: 'alpha' })
        async alphaTwo(x: string): Promise<void> { await makeFunc(rec, 'alpha', 10)(x) }

        @serialize({ perInstance: true, group: 'beta' })
        async beta(x: string): Promise<void> { await makeFunc(rec, 'beta', 15)(x) }
      }

      const ex = new Example()
      await Promise.all([ex.alphaOne('A'), ex.alphaTwo('B'), ex.beta('C'), ex.alphaOne('D')])

      // alpha serialized
      expect(rec.maxConcurrency('alpha')).toBe(1)
      // beta independent
      expect(rec.maxConcurrency('beta')).toBe(1)
      expect(rec.maxConcurrency()).toBe(2)
      expect(rec.results).toEqual(['alpha:A', 'beta:C', 'alpha:B', 'alpha:D'])
    })

    it('independent decorators (no group/perInstance) do not serialize across methods', async () => {

      class Example {
        @serialize()
        async slow(x: string): Promise<void> { await makeFunc(rec, 'slow', 30)(x) }

        @serialize()
        async fast(x: string): Promise<void> { await makeFunc(rec, 'fast', 10)(x) }
      }

      const ex = new Example()
      await Promise.all([ex.slow('A'), ex.fast('B')])

      expect(rec.maxConcurrency()).toBe(2)
      expect(rec.results).toEqual(['fast:B', 'slow:A'])
    })

    it('shared group across instances (without perInstance) serializes globally', async () => {

      class Example {
        constructor(readonly label: string) {}
        @serialize({ group: 'shared' })
        async act(x: string): Promise<void> {
          await makeFunc(rec, this.label, 10)(x)
        }
      }

      const a = new Example('A')
      const b = new Example('B')
      await Promise.all([a.act('1'), b.act('2'), a.act('3')])

      expect(rec.maxConcurrency()).toBe(1)
      expect(rec.results).toEqual(['A:1', 'B:2', 'A:3'])
    })

    it('shared group key works between functional and decorator forms', async () => {
      const group = Symbol('shared')

      const f = serialize({ group })(makeFunc(rec, 'func', 10))

      class Example {
        @serialize({ group })
        async run(x: string): Promise<void> { await makeFunc(rec, 'method', 10)(x) }
      }

      const ex = new Example()
      await Promise.all([f('A'), ex.run('B'), f('C')])

      // everything in shared group should serialize
      expect(rec.maxConcurrency()).toBe(1)
      expect(rec.results).toEqual(['func:A', 'method:B', 'func:C'])
    })
  })
})

