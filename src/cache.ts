import { deepEqual } from "fast-equals";
import { cloneDeep } from "lodash-es";
import LRUMap from "./lru";

/**
 * - data, loading, error 通过对比前后两次是否相等参与过期决策
 * - 其他属性为运行时需要, 不影响cache过期判断
 */
export type Cache<T> = {
  data: T | null;
  loading: boolean;
  error: any;
  revalidatePromise?: Promise<T>;
};
export const EMPTY_CACHE: Cache<unknown> = {
  data: null,
  loading: true,
  error: null,
};
type CacheListener = {
  // 订阅者, 可能是另外一个cache, 或者组件
  subscriber: string;
  excutor: () => void;
};

const MEM_CACHE: LRUMap<string, Cache<any>> = new LRUMap(500);
const CACHE_LISTENERS: Record<string, Array<CacheListener>> = {};

(window as any)["MEM_CACHE"] = MEM_CACHE;

// ---------------------------------------------------------------------------------------

function isCacheEqual(curCache: Cache<any>, nextCache: Cache<any>) {
  if (curCache.loading !== nextCache.loading) {
    return false;
  }

  if (!deepEqual(curCache.error, nextCache.error)) {
    return false;
  }

  return deepEqual(curCache.data, nextCache.data);
}
export function initCache<T>(partialCache?: Partial<Cache<T>>): Cache<T> {
  return {
    data: null,
    loading: false,
    error: null,
    ...(partialCache || {}),
  };
}

/**
 * 订阅cache, 在cache变化时将收到通知
 */
export function subscribeCache(key: string, sub: CacheListener) {
  // console.log(`subscribe to cache of ${key}`);
  let listeners = CACHE_LISTENERS[key];
  if (!listeners) {
    listeners = CACHE_LISTENERS[key] = [];
  }

  listeners.push(sub);

  return () => {
    listeners.splice(listeners.indexOf(sub), 1);
  };
}

export function setCache(key: string, value: Cache<unknown>) {
  MEM_CACHE.set(key, value);
}

/**
 * 更新缓存， 并检查缓存是否存在变换， 如果有变化， 则通知所有观察者
 */
export function refreshCache(
  key: string,
  cache: Cache<unknown>,
  tryToTriggerUpdate = true
) {
  const current = MEM_CACHE.get(key);
  MEM_CACHE.set(key, cache);

  // 一个缓存是否过期由两方面决定
  // 1. 缓存数据/状态/错误

  // edge case
  // 1. creative list, 按更新时间降序排列, 但在多个record更新时间完全相同时, 顺序是不稳定的
  // 前后两次顺序不一致的话, 这里也会认为不相等
  const notChange = current ? isCacheEqual(current, cache) : false;

  // 通知所有观察者， 引发组件更新(若有改变)
  if (tryToTriggerUpdate && !notChange) {
    broadcastCacheChange(key);
  }
}

export function broadcastCacheChange(key: string) {
  // 通知当前cache的所有观察者
  if (CACHE_LISTENERS[key]) {
    CACHE_LISTENERS[key].forEach((listener) => {
      listener.excutor();
    });
  }
}
export function readCache<T>(
  key: string
  // defaultListener?: CacheListener
): Cache<T> {
  // 如果没有， 就新建一个?
  let cache = MEM_CACHE.get(key);

  if (!cache) {
    setCache(key, cloneDeep(EMPTY_CACHE));
    cache = MEM_CACHE.get(key);

    // // 内部cache需要一个默认的listener, 用于通知外部的cache的观察者们
    // // 只在第一次创建时订阅
    // if (defaultListener) {
    //   subscribeCache(key, defaultListener);
    // }
  }
  return cache as Cache<T>;
}

export function readCacheListeners(key: string): CacheListener[] {
  return CACHE_LISTENERS[key] ?? [];
}

export function deleteCache(key: string) {
  MEM_CACHE.delete(key);
}
