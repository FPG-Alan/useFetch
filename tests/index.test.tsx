import React from "react";
import { Root, createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import useFetch, { deleteCache, mutateCache } from "../src";
import { cloneDeep } from "lodash-es";
import { readCache } from "../src/cache";
import LRUMap from "../src/lru";

function fetchMock(url: RequestInfo | URL): Promise<Response> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(new Response("Hello World", { status: 200 }));
    }, 200 + Math.random() * 300)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let windowSpy: any;

beforeEach(() => {
  windowSpy = jest.spyOn(window, "window", "get");
});

afterEach(() => {
  windowSpy.mockRestore();
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;
beforeEach(() => {
  // set up a DOM element as a render target
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  // cleanup on exiting
  if (container) {
    // After
    root?.unmount();
    container.remove();
    container = null;
  }
});

it("useFetch hook runs correctly", async () => {
  act(() => {
    root = createRoot(container!); // createRoot(container!) if you use TypeScript
    // @ts-ignore
    root.render(<App />);
  });
  expect(container?.textContent).toBe("loading");
  await act(() => sleep(200));
  const ps = container?.querySelectorAll("p");
  expect(ps?.length).toBe(3);

  const cache = readCache<Array<Todo>>(API);
  expect(cache?.data?.length).toBe(3);

  // @ts-ignore
  const allCache = window["MEM_CACHE"] as LRUMap<string, any>;
  expect(allCache.size).toBe(4);

  // click refresh button, cache should be used
  const refreshButton = container?.querySelector(".refresh");
  await act(() => {
    refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // on second refresh, the cache should be used
  const psAfterRefresh = container?.querySelectorAll("p");
  expect(psAfterRefresh?.length).toBe(3);

  // click delete button
  const deleteButton = container?.querySelector(".delete");
  await act(() => {
    deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(() => sleep(200));
  // on second refresh, the cache should be used
  const psAfterDelete = container?.querySelectorAll("p");
  expect(psAfterDelete?.length).toBe(2);
});

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};
const API = "users/todos";

const FAKE = [
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
      relation: function* (data) {
        for (let i = 0, l = data.length; i < l; i += 1) {
          yield { path: i.toString(), cacheKey: `users/1/todos/${data[i].id}` };
        }
      },

      // debug: true,
    }
  );

  if (cache.loading) {
    return <p>loading</p>;
  }

  return (
    <div>
      <button
        className="refresh"
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
          <span>{(item.completed && "√") || "×"}</span>
          {!item.completed && (
            <button
              className="done"
              onClick={() => {
                // mutateCache(API);
                const index = FAKE.findIndex((todo) => todo.id === item.id);
                if (index !== -1) {
                  FAKE[index].completed = true;
                }

                mutateCache(`users/1/todos/${item.id}`);
              }}
            >
              done
            </button>
          )}
          <button
            className="delete"
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
