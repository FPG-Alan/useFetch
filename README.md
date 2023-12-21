# useFetch

A React hook for date fetching based on [useSWR](https://github.com/vercel/swr)

# Motivation

The caching granularity of useSWR is relatively coarse, which hinders cache utilization.

For example, in a scenario where a `user/list` cache is requested first, useSWR cannot utilize the `user/list` cache when the data for `user/<user_id>` is needed.
It also cannot update the `user/list` cache when the `user/<user_id>` cache mutates.

Therefore, based on useSWR, I made some modifications and created this library.

# Installation

```bash
pnpm install use-get-data
```

# Usage

```tsx
type ListData<T> = {
  offset: number;
  limit: number;
  records: Array<T>;
  total: number;
};
type User = {
  id: number;
  name: string;
  profile: Record<string, unknown>;
};
const UserList = () => {
  const { data, error, isLoading } = useFetch<ListData<User>>(
    "/api/users",
    fetcher,
    {
      relation: function* (data) {
        for (let i = 0, l = data.records.length; i < l; i += 1) {
          yield {
            path: `records.${i}`,
            cacheKey: `users/${data.records[i].id}`,
          };
        }
      },
    }
  );

  if (error) return "An error has occurred.";
  if (isLoading) return "Loading...";

  return (
    <div>
      {data.records.map((user) => (
        <p>{user.name}</p>
      ))}
    </div>
  );
};
```
