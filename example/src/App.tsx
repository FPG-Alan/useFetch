import useFetch, { mutateCache } from "lib";
import { cloneDeep } from "lodash-es";
import { deleteCache } from "../../dist/lib";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

const API = "https://jsonplaceholder.typicode.com/users/1/todos";

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
function App() {
  const [cache] = useFetch<Array<Todo>>(
    API,
    (api) => {
      return new Promise((resolve) => {
        resolve(cloneDeep(FAKE));
      });
    },
    {
      fineGrainedIter: function* (data) {
        for (let i = 0, l = data.length; i < l; i += 1) {
          yield { path: i.toString(), cacheKey: `users/1/todos/${data[i].id}` };
        }
      },
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
      {cache.data?.map((item) => (
        <p key={item.id}>
          <span>{item.id}:</span>
          <span>{item.title}</span>
          <button
            onClick={() => {
              // mutateCache(API);
              const index = FAKE.findIndex((todo) => todo.id === item.id);
              if (index !== -1) {
                FAKE.splice(index, 1);
              }

              deleteCache(`users/1/todos/${item.id}`);
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
