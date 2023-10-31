import useFetch, { mutateCache } from "lib";
import { clone, cloneDeep, set, unset } from "lodash-es";
import { deleteCache } from "../../dist/lib";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

const API = "/api/users/1/todos";

const TITLES = ["111", "222", "333", "444", "aaa", "bbb"];
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

const test = {
  limit: -1,
  total: 3,
  records: cloneDeep(FAKE),
  offset: 0,
};

// unset(test, "records.0");
// set(test, "records.0", { a: "a" });
// console.log(test);
function App() {
  const [cache] = useFetch<any>(
    API,
    (api) => {
      // console.log("reload");
      return new Promise((resolve) => {
        const aa = cloneDeep(FAKE);
        // console.log(cloneDeep(aa));
        resolve({
          limit: -1,
          total: 3,
          records: aa,
          offset: 0,
        });
      });
    },
    {
      relation: function* (data) {
        for (let i = 0, l = data.records.length; i < l; i += 1) {
          yield {
            path: `records.${i}`,
            cacheKey: `/api/users/1/todos/${data.records[i].id}`,
          };
        }
      },

      // debug: true,
    }
  );

  if (cache.loading) {
    return <p>loading...</p>;
  }

  console.log("render", cache.data);

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
