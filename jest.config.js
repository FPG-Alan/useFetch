/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",

  // lodash-es use es module, which is not supported by jest
  moduleNameMapper: {
    "^lodash-es$": "lodash",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup-env.tsx"],
};
