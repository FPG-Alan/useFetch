import { mutateCache } from "lib";

import useData from "./api/useData";

// type Todo = {
//   userId: number;
//   id: number;
//   title: string;
//   completed: boolean;
// };

const API = "https://jsonplaceholder.typicode.com/users/1/todos";

// const TITLES = ["111", "222", "333", "444", "aaa", "bbb"];
// const FAKE: Todo[] = [
//   {
//     userId: 1,
//     id: 1,
//     title: "111",
//     completed: false,
//   },
//   {
//     userId: 1,
//     id: 2,
//     title: "222",
//     completed: false,
//   },
//   {
//     userId: 1,
//     id: 3,
//     title: "333",
//     completed: false,
//   },
// ];

function App() {
  // client.GET("/users", { params: { query: { limit: 10 } } });
  // const userid: number | null = 13;
  // const [aaa] = useData((userid && `/users/{user_id}/emails`) || "", {
  //   params: { user_id: userid },
  // });
  const [cache] = useData("/users/{user_id}", [
    { params: { path: { user_id: 13 } } },
  ]);
  const [cache2] = useData("/account/notifications/{notification_id}", [
    { params: { path: { notification_id: 12 } } },
  ]);

  console.log(cache2);
  // cache.data?.records[0].id;

  // cache.data.aaaa
  // const [cache2] = useData(cache.data && `/users/${cache.data.}` || '')
  // const [cache] = useFetch<Array<Todo>>(API, GET, {
  //   fineGrainedIter: function* (data) {
  //     for (let i = 0, l = data.length; i < l; i += 1) {
  //       yield { path: i.toString(), cacheKey: `users/1/todos/${data[i].id}` };
  //     }
  //   },

  //   debug: true,
  // });

  if (cache.loading) {
    return <p>loading...</p>;
  }

  // useEffect(() => {
  //   POST("/share_links", { body: {} });
  // }, []);
  return <p>{cache.data?.display_name}</p>;

  // console.log("render", cache.data.);

  return (
    <div>
      <button
        onClick={() => {
          mutateCache(API);
        }}
      >
        refresh
      </button>

      {}
    </div>
  );
}

export default App;
