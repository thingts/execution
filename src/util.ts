import type { DelaySpec } from './types'

// until https://tc39.es/proposal-upsert/ gets standardized & adopted
export function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, compute: () => V): V
export function getOrInsertComputed<K extends WeakKey, V>(map: WeakMap<K, V>, key: K, compute: () => V): V
export function getOrInsertComputed<K extends WeakKey, V>(map: Map<K, V> | WeakMap<K, V>, key: K, compute: () => V): V {
  let val = map.get(key)
  if (val === undefined) {
    val = compute()
    map.set(key, val)
  }
  return val
}

export function resolveDelay(thisArg: unknown, delay: DelaySpec): number {
  return typeof delay === 'function' ? delay(thisArg) : delay
}
