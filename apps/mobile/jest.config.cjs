module.exports = {
  preset: "jest-expo",
  // Shared protocol sources live outside this independently installed Expo project.
  modulePaths: ["<rootDir>/node_modules"],
  // Jest treats the separator before a dotted Windows directory as a glob escape.
  testMatch: [`${__dirname.replaceAll("\\", "/")}/test/**/*.test.tsx`],
  setupFilesAfterEnv: ["<rootDir>/test/native.test-support.ts"],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  coverageProvider: "babel",
  coverageReporters: ["json", "text-summary"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.test.ts"],
};
