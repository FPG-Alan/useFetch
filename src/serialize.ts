import { stableHash } from "./hash";

export const isFunction = <
  T extends (...args: any[]) => any = (...args: any[]) => any
>(
  v: unknown
): v is T => typeof v == "function";

export const serialize = (
  key: string | Array<any> | Function
): [string, typeof key] => {
  if (isFunction(key)) {
    try {
      key = key();
    } catch (err) {
      // dependencies not ready
      key = "";
    }
  }

  // Use the original key as the argument of fetcher. This can be a string or an
  // array of values.
  const args = key;

  // If key is not falsy, or not an empty array, hash it.
  key =
    typeof key == "string"
      ? key
      : (Array.isArray(key) ? key.length : key)
      ? stableHash(key)
      : "";

  return [key, args];
};
