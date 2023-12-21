import { cloneDeep } from "lodash-es";
import { deepEqual } from "fast-equals";

import LRUMap from "./lru";
import { mutateCache } from "./useFetch";

export type Cache<T> = {
  data: T | null;
  loading: boolean;
  error: any;

  /**
   * clean up stuff
   * such as deps/parents
   */
  __destory: Function;

  /**
   * dep cache keys,
   * link to caches which has __parents inlude this cache key
   */
  __deps?: Set<string>;
  __parents?: Set<string>;
};
export const EMPTY_CACHE: Cache<unknown> = {
  data: null,
  loading: true,
  error: null,
  __destory: beforeDeleteCache,
};
type CacheListener = {
  // another cache, or react component
  subscriber: string;
  excutor: () => void;
};

const MEM_CACHE: LRUMap<string, Cache<any>> = new LRUMap(500);
const CACHE_LISTENERS: Record<string, Array<CacheListener>> = {};

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
    __destory: beforeDeleteCache,
    ...(partialCache || {}),
  };
}

export function subscribeCache(key: string, sub: CacheListener) {
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

export function refreshCache(
  key: string,
  cache: Cache<unknown>,
  tryToTriggerUpdate = true
) {
  const current = MEM_CACHE.get(key);
  MEM_CACHE.set(key, cache);

  const notChange = current ? isCacheEqual(current, cache) : false;

  if (tryToTriggerUpdate && !notChange) {
    broadcastCacheChange(key);

    // some cache relay on current one
    // We should assume that these caches have also changed
    if (cache.__parents && cache.__parents.size > 0) {
      for (const pKey of cache.__parents) {
        // change p cache's memory address
        // react will get new cache through getSnapshot
        const pCache = MEM_CACHE.incognitoGet(pKey);
        if (pCache) {
          MEM_CACHE.set(pKey, { ...pCache });

          // broadcast change
          broadcastCacheChange(pKey);
        }
      }
    }
  }
}

export function broadcastCacheChange(key: string) {
  if (CACHE_LISTENERS[key]) {
    CACHE_LISTENERS[key].forEach((listener) => {
      listener.excutor();
    });
  }
}
export function readCache<T>(key: string): Cache<T> {
  let cache = MEM_CACHE.get(key);

  if (!cache) {
    setCache(key, cloneDeep(EMPTY_CACHE));
    cache = MEM_CACHE.get(key);
  }
  return cache as Cache<T>;
}

export function readCacheListeners(key: string): CacheListener[] {
  return CACHE_LISTENERS[key] ?? [];
}

function beforeDeleteCache(cacheKey: string, cache: Cache<unknown>) {
  if (cache.__deps) {
    for (const depKey of cache.__deps) {
      // use incognito mode avoid break lru mechanism
      const depCache = MEM_CACHE.incognitoGet(depKey);

      if (depCache && depCache.__parents) {
        // delete current cache key from it's dep cache's parents
        depCache.__parents.delete(cacheKey);
      }
    }
  }

  if (cache.__parents) {
    for (const pKey of cache.__parents) {
      // use incognito mode avoid break lru mechanism
      const parentCache = MEM_CACHE.incognitoGet(pKey);

      if (parentCache) {
        // dep delete, we treat it as change of the parent cache
        // just refresh it
        mutateCache(pKey);
      }
    }
  }
}
export function deleteCache(key: string) {
  const cacheWillBeDelete = readCache(key);
  beforeDeleteCache(key, cacheWillBeDelete);

  MEM_CACHE.delete(key);
}
