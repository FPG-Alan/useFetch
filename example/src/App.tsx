import useFetch from "lib";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

const API = "https://jsonplaceholder.typicode.com/users/1/todos";

function App() {
  const [cache] = useFetch<Array<Todo>>(
    API,
    (api) => fetch(api).then((res) => res.json()),
    {
      fineGrainedIter: function* (data) {
        for (let i = 0, l = data.length; i < l; i += 1) {
          yield { record: data[i], cacheKey: `users/1/todos/${data[i].id}` };
        }
      },
      debug: true,
      // autoRefresh: true,
    }
  );

  if (cache.loading) {
    return <p>loading...</p>;
  }

  console.log(cache.data);

  return (
    <div>
      {cache.data?.map((item) => (
        <p key={item.id}>
          <span>{item.id}:</span>
          <span>{item.title}</span>
        </p>
      ))}
    </div>
  );
}

export default App;
