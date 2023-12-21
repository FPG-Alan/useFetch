import useFetch, { mutateCache } from "lib";
import { cloneDeep } from "lodash-es";
import { deleteCache } from "../../dist/lib";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};
type ListData<T> = {
  limit: number;
  total: number;
  records: T[];
  offset: number;
};

const FAKE: Todo[] = [
  {
    userId: 1,
    id: 1,
    title: "111",
    completed: false,
  },
  {
    userId: 1,
    id: 2,
    title: "222",
    completed: false,
  },
  {
    userId: 1,
    id: 3,
    title: "333",
    completed: false,
  },
];

const API = "/api/users/1/todos";
function App() {
  const [cache] = useFetch<ListData<Todo>>(
    API,
    () =>
      new Promise((resolve) => {
        const data = cloneDeep(FAKE);
        resolve({
          limit: -1,
          total: 3,
          records: data,
          offset: 0,
        });
      }),
    {
      relation: function* (data) {
        for (let i = 0, l = data.records.length; i < l; i += 1) {
          yield {
            path: `records.${i}`,
            cacheKey: `/api/users/1/todos/${data.records[i].id}`,
          };
        }
      },
    }
  );

  if (cache.loading) {
    return <p>loading...</p>;
  }

  return (
    <div>
      <button
        onClick={() => {
          mutateCache(API);
        }}
      >
        refresh
      </button>
      {cache.data?.records.map((item) => (
        <p key={item.id}>
          <span>{item.id}:</span>
          <span>{item.title}</span>
          <span>{(item.completed && "√") || "×"}</span>
          {!item.completed && (
            <button
              onClick={() => {
                // mutateCache(API);
                const index = FAKE.findIndex((todo) => todo.id === item.id);
                if (index !== -1) {
                  FAKE[index].completed = true;
                }

                mutateCache(`/api/users/1/todos/${item.id}`);
              }}
            >
              done
            </button>
          )}
          <button
            onClick={() => {
              // mutateCache(API);
              const index = FAKE.findIndex((todo) => todo.id === item.id);
              if (index !== -1) {
                FAKE.splice(index, 1);
              }

              deleteCache(`/api/users/1/todos/${item.id}`);
              // mutateCache(API);
            }}
          >
            delete
          </button>
        </p>
      ))}
    </div>
  );
}

export default App;
