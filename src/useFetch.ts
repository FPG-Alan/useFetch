import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { assign, cloneDeep, get, isArray, set } from "lodash-es";

import { serialize } from "./serialize";
import { isVisible } from "./webPreset";
import {
  EMPTY_CACHE,
  readCache,
  Cache,
  subscribeCache,
  refreshCache,
} from "./cache";
import randomUUID from "./uuid";

const CACHE_REVALIDATE_FUNCTION_POOL: Record<
  string,
  Record<string, () => void | Promise<void>>
> = {};

const CACHE_REVALIDATE_PROMISE_POOL: Record<string, Promise<unknown>> = {};

export interface StateDependencies {
  data?: boolean;
  error?: boolean;
  loading?: boolean;
}

type UseFetchOption<T> = {
  autoRefresh?: boolean;
  debug?: boolean;
  delay?: number;
  relation?: (
    data: T
  ) => Generator<{ cacheKey: string; path: string }, void, undefined>;
};
const DEFAULT_OPTIONS = {
  autoRefresh: false,
  debug: false,
};

function useFetch<T>(
  key: string | Array<any> | Function,
  fetcher: (...args: unknown[]) => Promise<T>,
  options?: UseFetchOption<T>
): [Omit<Cache<T>, "__destory">] {
  const _options = { ...DEFAULT_OPTIONS, ...(options || {}) };

  // eslint-disable-next-line prefer-const
  let [cacheKey, fnArg] = serialize(key);
  fnArg = fnArg instanceof Array ? fnArg : [fnArg];
  const stateDependencies = useRef<StateDependencies>({});
  const unsubscribe = useRef<Function>();
  const mount = useRef(true);
  const firstOfThisMount = useRef(true);

  const log = useCallback(
    (...arg: unknown[]) => {
      if (_options.debug) {
        console.log(...arg);
      }
    },
    [_options.debug]
  );

  const subsrciber = useCallback(
    (callback: () => void) => {
      unsubscribe.current?.();
      if (cacheKey) {
        unsubscribe.current = subscribeCache(cacheKey, {
          subscriber: "Component",
          excutor: () => {
            log(`${cacheKey} request an update`);
            callback();
          },
        });
      }
      const unsubscribeFn = unsubscribe.current ?? (() => void 0);

      return unsubscribeFn as () => void;
    },
    [cacheKey, log]
  );

  // react subscribe to cache
  const cache = useSyncExternalStore(subsrciber, () => {
    // empty key indicate no need to request
    if (!cacheKey) {
      return EMPTY_CACHE as Cache<T>;
    }

    const snapshot = readCache<T>(cacheKey);
    return snapshot;
  });

  const revalidate = useCallback(() => {
    if (cacheKey) {
      log("revalidate", cacheKey);

      // dedup
      let revalidatePromise = CACHE_REVALIDATE_PROMISE_POOL[
        cacheKey
      ] as Promise<T>;
      if (!revalidatePromise) {
        CACHE_REVALIDATE_PROMISE_POOL[cacheKey] = revalidatePromise = fetcher(
          ...((isArray(fnArg) && fnArg) || [fnArg])
        );
      }

      // delay
      let promise = revalidatePromise;
      if (options?.delay) {
        promise = new Promise((resolve, reject) => {
          setTimeout(() => {
            revalidatePromise?.then(resolve).catch(reject);
          }, options.delay);
        });
      }

      // set fulfill as false
      const cache = readCache(cacheKey);
      cache["__fulfilled"] = false;
      return promise
        .then((data) => {
          // only handle first resolve during multi resolves for same promise
          if (!cache["__fulfilled"]) {
            // begin fulfill
            if (_options.relation) {
              for (const {
                path,
                cacheKey: fineGrainedCacheKey,
              } of _options.relation(data)) {
                const fineGrainedData = get(data, path);

                // get, or create fine grained cache
                const innerCache = readCache<unknown>(fineGrainedCacheKey);
                // connect finegrained cache and current cache
                if (!cache.__deps) {
                  cache.__deps = new Set();
                }
                cache.__deps?.add(fineGrainedCacheKey);

                if (!innerCache.__parents) {
                  innerCache.__parents = new Set();
                }
                innerCache.__parents.add(cacheKey);
                // console.log("refresh fine grained cache", fineGrainedData);
                // refresh fine grained cache
                refreshCache(fineGrainedCacheKey, {
                  ...innerCache,
                  loading: false,
                  data: fineGrainedData,
                });

                // data is just pointer(under fine grained mode)
                set(data as any as object, path, {
                  __cache_key__: fineGrainedCacheKey,
                });
              }
            }

            // finish fulfill
            refreshCache(
              cacheKey,
              {
                ...cache,
                loading: false,
                data,
              },
              stateDependencies.current.data ||
                stateDependencies.current.loading
            );
            cache["__fulfilled"] = true;
          }
        })
        .catch((reason: unknown) => {
          log(cacheKey, "revalidate error");

          refreshCache(
            cacheKey,
            {
              ...cache,
              loading: false,
              error: reason,
            },
            stateDependencies.current.data || stateDependencies.current.loading
          );
        })
        .finally(() => {
          log(cacheKey, "revalidate done");
          delete CACHE_REVALIDATE_PROMISE_POOL[cacheKey];
        });
    }
  }, [cacheKey, cache, key, log]);

  // 1. regist revalidate to global pool
  // 2. issue first revalidate
  // 3. revalidate after cache key changed
  useLayoutEffect(() => {
    if (cacheKey) {
      const revalidate_key = randomUUID();
      if (!CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]) {
        CACHE_REVALIDATE_FUNCTION_POOL[cacheKey] = {};
      }
      CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][revalidate_key] = revalidate;

      requestAnimationFrame(revalidate);

      return () => {
        if (CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][revalidate_key]) {
          delete CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][revalidate_key];
        }
      };
    }
  }, [cacheKey]);

  useLayoutEffect(() => {
    if (!cache && !firstOfThisMount.current) {
      requestAnimationFrame(revalidate);
    }
  }, [cache]);

  useEffect(() => {
    return () => {
      unsubscribe.current?.();
    };
  }, [cacheKey]);

  useEffect(() => {
    firstOfThisMount.current = false;
    return () => {
      mount.current = false;
    };
  }, []);

  // heartbeat
  useLayoutEffect(() => {
    let timer: any;
    function next() {
      // Use the passed interval
      // ...or invoke the function with the updated data to get the interval
      const interval = 5000;

      // We only start the next interval if `refreshInterval` is not 0, and:
      // - `force` is true, which is the start of polling
      // - or `timer` is not 0, which means the effect wasn't canceled
      if (interval && timer !== -1) {
        timer = setTimeout(execute, interval);
      }
    }

    function execute() {
      // Check if it's OK to execute:
      // Only revalidate when the page is visible, online, and not errored.
      if (isVisible() /*  && isOnline() */) {
        revalidate()?.then(next);
      } else {
        // Schedule the next interval to check again.
        next();
      }
    }

    if (_options.autoRefresh) {
      next();
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = -1;
      }
    };
  }, [revalidate]);

  return [
    {
      get data() {
        stateDependencies.current.data = true;
        if (
          cache.data &&
          cache.__deps &&
          cache.__deps.size > 0 &&
          _options.relation
        ) {
          // when snapshot has data, we need check if cache has deps
          // which need be fulfilled
          const _data = cloneDeep(cache.data);
          for (const { path, cacheKey } of _options.relation(_data)) {
            const record = get(_data, path);
            const innerData = readCache(record["__cache_key__"]).data || {};

            assign(record, innerData);
          }

          return _data;
        }

        return cache?.data ?? null;
      },
      get error() {
        stateDependencies.current.error = true;
        return cache?.error ?? null;
      },
      get loading() {
        stateDependencies.current.loading = true;
        return cache?.loading ?? true;
      },
    },
  ];
}

type MutateOption<T> = {
  optimisticData?: Cache<T>;
  revalidate?: boolean;
};
const DEFAULT_MUTATE_OPTIONS = {
  revalidate: true,
};
function mutateCache<T>(
  cacheKey: string,
  mutationFun?: () => Promise<Cache<T> | void>,
  options?: MutateOption<T>
) {
  if (cacheKey) {
    const cache = readCache(cacheKey);
    // if this cache dependent on other cache
    // we dit not support mutationFun/options
    if (cache.__deps && cache.__deps.size > 0) {
      if (CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]) {
        Object.keys(CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]).forEach((key) => {
          CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][key]();
        });
      }

      return;
    }

    const _options = { ...DEFAULT_MUTATE_OPTIONS, ...(options || {}) };

    if (_options.optimisticData) {
      refreshCache(cacheKey, _options.optimisticData);
    }

    if (mutationFun) {
      mutationFun().then((nextCache) => {
        if (!_options.optimisticData && nextCache) {
          refreshCache(cacheKey, nextCache);
        }

        if (CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]) {
          Object.keys(CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]).forEach(
            (key) => {
              CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][key]();
            }
          );
        }

        // if cache has parent caches, they should also revalidate
        if (cache.__parents && cache.__parents.size > 0) {
          for (const pKey of cache.__parents) {
            if (CACHE_REVALIDATE_FUNCTION_POOL[pKey]) {
              Object.keys(CACHE_REVALIDATE_FUNCTION_POOL[pKey]).forEach(
                (key) => {
                  CACHE_REVALIDATE_FUNCTION_POOL[pKey][key]();
                }
              );
            }
          }
        }
      });
    } else if (_options.revalidate) {
      if (CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]) {
        Object.keys(CACHE_REVALIDATE_FUNCTION_POOL[cacheKey]).forEach((key) => {
          CACHE_REVALIDATE_FUNCTION_POOL[cacheKey][key]();
        });
      }

      // if cache has parent caches, they should also revalidate
      if (cache.__parents && cache.__parents.size > 0) {
        for (const pKey of cache.__parents) {
          if (CACHE_REVALIDATE_FUNCTION_POOL[pKey]) {
            Object.keys(CACHE_REVALIDATE_FUNCTION_POOL[pKey]).forEach((key) => {
              CACHE_REVALIDATE_FUNCTION_POOL[pKey][key]();
            });
          }
        }
      }
    }
  }
}

export { mutateCache };
export default useFetch;
