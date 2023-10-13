// export function sum(a: number, b: number) {
//   return a + b;
// }

import useFetch, { mutateCache } from "./useFetch";
import { deleteCache } from "./cache";

export { mutateCache, deleteCache };
export default useFetch;
