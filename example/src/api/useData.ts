import useFetch from "lib";
import { client } from "./client";
import {
  FilterKeys,
  HasRequiredKeys,
  PathsWithMethod,
} from "openapi-typescript-helpers";
import { type paths } from "./v1";
import { FetchOptions } from "openapi-fetch";

function useData<P extends PathsWithMethod<paths, "get">>(
  endpoint: P,
  pathParam: HasRequiredKeys<
    FetchOptions<FilterKeys<paths[P], "get">>
  > extends never
    ? [(FetchOptions<FilterKeys<paths[P], "get">> | undefined)?]
    : [FetchOptions<FilterKeys<paths[P], "get">>],
  options?: Parameters<typeof useFetch>[2]
) {
  const [cache] = useFetch(
    endpoint,
    async () => {
      const resp = await client.GET(endpoint, ...pathParam);

      return resp.data;
    },
    options
  );

  return [cache];
}

export default useData;
