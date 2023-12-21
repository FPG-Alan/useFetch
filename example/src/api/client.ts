import createClient from "openapi-fetch";
import { paths } from "./v1";

const token =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoxMywiZXhwIjoxNjk3NzY2MjI2fQ.pzc3jF0Zd66t103nfUtcM4dNc4BuTWyO2QJccn21Z0Q";

export const client = createClient<paths>({
  baseUrl: "http://127.0.0.1:9119",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
