/**
 * 1. stale while revalidate
 * 2. dedupe
 * 3. auto-cancel
 * 4. suspense
 * 5.
 */

// @ts-ignore
// import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { serialize } from "./serialize";
import { isVisible } from "./webPreset";
import {
  EMPTY_CACHE,
  innerMutateCache,
  readCache,
  Cache,
  subscribeCache,
} from "./cache";
import { assign, cloneDeep, isArray } from "lodash-es";
import { DBRecord, insert } from "./db";

// 用于收集对某个key的缓存
const CACHE_REVIDATE_POOL: Record<
  string,
  Record<string, () => void | Promise<void>>
> = {};
// (window as any)["debug_cache_revalidate_pool"] = CACHE_REVIDATE_POOL;

export interface StateDependencies {
  data?: boolean;
  error?: boolean;
  loading?: boolean;
}

type UseFetchOption<T> = {
  autoRefresh?: boolean;
  debug?: boolean;
  /**
   * 如果你认为从API上无法分析实体对应的结构
   * 传入这个参数将会覆盖默认的行为
   */
  // fineGrained?: (data: T) => Array<{ tableName: string; records: DBRecord[] }>;

  fineGrainedIter?: (
    data: T
  ) => Iterable<{ tableName: string; record: unknown }>;
};
const DEFAULT_OPTIONS = {
  autoRefresh: false,
  debug: false,
};

/**
 * 1. cache
 * 2. revalidate
 * 3. dedupe
 * 4. heartbeat
 * 5. 更细粒度的缓存
 *
 *
 *
 * @desc 09/01/2022
 * 重新验证的时机:
 * 1. mount时重新验证
 * 2. key变化时重新验证
 * 3. 上述两者都没有变化， 但cache被删除时重新验证
 */
function useFetch<T>(
  key: string | Array<any> | Function,
  fetcher: (...args: any) => Promise<T>,
  options?: UseFetchOption<T>
) {
  const _options = { ...DEFAULT_OPTIONS, ...(options || {}) };

  // eslint-disable-next-line prefer-const
  let [cacheKey, fnArg] = serialize(key);
  fnArg = fnArg instanceof Array ? fnArg : [fnArg];
  const stateDependencies = useRef<StateDependencies>({});
  const unsubscribe = useRef<Function>();
  const mount = useRef(true);
  const firstOfThisMount = useRef(true);

  const log = useCallback(
    (...arg: any) => {
      if (_options.debug) {
        console.log(...arg);
      }
    },
    [_options.debug]
  );

  const subsrcibe = useCallback(
    (callback: () => void) => {
      unsubscribe.current?.();
      if (cacheKey) {
        unsubscribe.current = subscribeCache(cacheKey, () => {
          log(`${cacheKey} request an update`);
          callback();
        });
      }
      const unsubscribeFn = unsubscribe.current ?? (() => void 0);

      return unsubscribeFn as () => void;
    },
    [cacheKey, log]
  );

  /**
   * cache 变化触发react更新
   */
  const cache = useSyncExternalStore(subsrcibe, () => {
    // key 为空代表暂时不需要写缓存
    if (!cacheKey) {
      return EMPTY_CACHE as Cache<T>;
    }
    return readCache<T>(cacheKey);
  });

  const revalidate = useCallback(() => {
    // 1. key 为空代表暂时不需要请求
    if (cacheKey) {
      log("revalidate", cacheKey);
      let revalidatePromise = cache?.revalidatePromise;
      if (!revalidatePromise) {
        revalidatePromise = fetcher(...((isArray(fnArg) && fnArg) || [fnArg]));
      }

      return revalidatePromise
        .then((data) => {
          if (options?.fineGrainedIter) {
            // 这个cache的内容将是其他cache
            // 每个data内部都清空了， 填入所依赖的cacheKey
            for (
              let i = 0, l = (data as any as Array<any>).length;
              i < l;
              i += 1
            ) {
              const fineGrainedData = (data as any as Array<any>)[i];
              const fineGrainedCacheKey = `users/1/todos/${fineGrainedData.id}`;

              const fineGrainedCache = readCache<unknown>(fineGrainedCacheKey);

              // 当内部缓存发生变化时， 外部缓存进行脏检查， 当然这时一定是脏的
              subscribeCache(fineGrainedCacheKey, () => {
                innerMutateCache(
                  cacheKey,
                  cache,
                  stateDependencies.current.data ||
                    stateDependencies.current.loading
                );
              });

              // 细粒度缓存触发更新
              innerMutateCache(
                fineGrainedCacheKey,
                {
                  ...fineGrainedCache,
                  loading: false,
                  data: cloneDeep(fineGrainedData),
                },
                true
              );

              // 问题是如何处理外部缓存中的数据
              // 现在只知道外部缓存依赖了哪些内部缓存(fineGrainedCacheKey集合)， 但内部缓存和数据中具体的部分没有关系
              fineGrainedData["__cache_key__"] = fineGrainedCacheKey;

              Object.keys(fineGrainedData).forEach((key) => {
                if (key !== "__cache_key__") {
                  delete fineGrainedData[key];
                }
              });
            }
            innerMutateCache(
              cacheKey,
              {
                ...cache,
                loading: false,
                data,
              },
              stateDependencies.current.data ||
                stateDependencies.current.loading
            );
          } else {
            // 异步之后, cache可能已经被删除
            innerMutateCache(
              cacheKey,
              {
                ...cache,
                loading: false,
                data,
              },
              stateDependencies.current.data ||
                stateDependencies.current.loading
            );
          }
        })
        .catch(({ error }: any) => {
          log(cacheKey, "revalidate error");

          innerMutateCache(
            cacheKey,
            {
              ...cache,
              loading: false,
              error,
            },
            stateDependencies.current.data || stateDependencies.current.loading
          );
        })
        .finally(() => {
          log(cacheKey, "revalidate done");
          // console.log(cache);
          cache.revalidatePromise = undefined;
        });
    }
  }, [cacheKey, cache, key, log]);

  // 1. 注册revalidate函数到全局事件池
  // 2. mount阶段重新验证
  // 3. cacheKey变化时重新验证
  useLayoutEffect(() => {
    if (cacheKey) {
      const revalidate_key = window.crypto.randomUUID();
      if (!CACHE_REVIDATE_POOL[cacheKey]) {
        CACHE_REVIDATE_POOL[cacheKey] = {};
      }
      CACHE_REVIDATE_POOL[cacheKey][revalidate_key] = revalidate;

      requestAnimationFrame(revalidate);

      return () => {
        if (CACHE_REVIDATE_POOL[cacheKey][revalidate_key]) {
          delete CACHE_REVIDATE_POOL[cacheKey][revalidate_key];
        }
      };
    }
  }, [cacheKey]);

  // cache被删除时重新验证
  useLayoutEffect(() => {
    // 无cache并且也不是mount阶段
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

  // 心跳包
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
      console.log(key, "autoRefresh");
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
      // 依赖收集
      get data() {
        stateDependencies.current.data = true;

        // 检查是否存在__cache_key__, 如果存在则填充

        if (cache?.data) {
          const _data = cloneDeep(cache.data) as any;
          for (let i = 0, l = _data.length; i < l; i += 1) {
            const innerData = readCache(_data[i]["__cache_key__"]).data;
            assign(_data[i], innerData);
          }

          return _data;
        }

        return null;

        // return cache?.data ?? null;
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

/**
 *
 * @param cacheKey
 * @param partialCache
 * @param tryToTriggerUpdate 是否触发组件更新, 一般用于批量修改缓存的情况, 设置为false, 在修改完成后手动触发一次更新以提高性能
 * @param revalidate 是否对数据进行验证,
 *
 */
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
    const _options = { ...DEFAULT_MUTATE_OPTIONS, ...(options || {}) };

    // 乐观更新， 直接改变本地数据
    if (_options.optimisticData) {
      innerMutateCache(cacheKey, _options.optimisticData);
    }

    if (mutationFun) {
      mutationFun().then((nextCache) => {
        // 1. 乐观更新时， 不需要返回值， 直接revalidate
        // 2. 有的修改就没有返回值， 也直接revalidate
        if (!_options.optimisticData && nextCache) {
          innerMutateCache(cacheKey, nextCache);
        }
        // 通知所有mount状态的组件重新验证数据
        if (CACHE_REVIDATE_POOL[cacheKey]) {
          Object.keys(CACHE_REVIDATE_POOL[cacheKey]).forEach((key) => {
            CACHE_REVIDATE_POOL[cacheKey][key]();
          });
        }
      });
    } else if (_options.revalidate) {
      // 通知所有mount状态的组件重新验证数据
      if (CACHE_REVIDATE_POOL[cacheKey]) {
        Object.keys(CACHE_REVIDATE_POOL[cacheKey]).forEach((key) => {
          CACHE_REVIDATE_POOL[cacheKey][key]();
        });
      }
    }
  }
}

export { mutateCache };
export default useFetch;
