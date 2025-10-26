import { sleep } from './sleep'

export function makeRecorder() { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  let active = 0
  let max    = -Infinity
  const byLabel:    Record<string, number> = {}
  const maxByLabel: Record<string, number> = {}
  const results: string[] = []

  function enter(label: string): void {
    active += 1
    byLabel[label] = (byLabel[label] || 0) + 1
    if (active > max) {
      max = active
    }
    if (byLabel[label] > (maxByLabel[label] || -Infinity)) {
      maxByLabel[label] = byLabel[label]
    }
  }

  function exit(label: string, result: string): void {
    active -= 1
    byLabel[label] -= 1
    results.push(result)
  }

  function maxConcurrency(label?: string): number {
    return label ? maxByLabel[label] : max
  }

  return { enter, exit, maxConcurrency, results }
}

export type Recorder = ReturnType<typeof makeRecorder>

export function makeFunc(
  rec: Recorder,
  label: string,
  delay: number,
) {
  return async (x: string | number) => {
    rec.enter(label)
    await sleep(delay)
    rec.exit(label, `${label}:${String(x)}`)
  }
}
