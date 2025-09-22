# Issue: Persistent Jest ESM SyntaxError in Login Function Test

## Problem Description

When running unit tests, the `login.test.js` suite consistently fails with a `SyntaxError: The requested module '@atproto/api' does not provide an export named 'BskyAgent'`.

This error occurs despite attempts to correctly mock the `@atproto/api` module's default export, and even after exporting the `login` function from `skysweep.js` for direct import into the test file.

## Context

- **Test File:** `__tests__/login.test.js`
- **Function Under Test:** `login` (now exported from `skysweep.js`)
- **Problematic Import:** `BskyAgent` from `@atproto/api`
- **Environment:** Node.js project with `"type": "module"` (ESM) and Jest for testing.

Jest's ESM support, particularly with mocking default exports and destructuring, is known to be complex and prone to such errors. It appears Jest is failing to correctly apply the mock to the `BskyAgent` import within the `skysweep.js` module when that module is loaded by the test runner.

## Proposed Solution (Refactoring for Testability)

To resolve this persistent issue and make the `login` function properly testable, the proposed solution is to refactor the `login` function into its own dedicated utility file.

**Steps:**
1.  **Move `login` function:** Extract the `login` function from `skysweep.js` and place it into a new file, e.g., `utils/auth.js`.
2.  **Update `skysweep.js`:** Modify `skysweep.js` to import the `login` function from `utils/auth.js`.
3.  **Update `login.test.js`:** Modify `login.test.js` to import the `login` function directly from `utils/auth.js`.

This refactoring will isolate the `login` function's dependencies, allowing Jest to apply the `@atproto/api` mock more effectively without interference from the broader `skysweep.js` module context.

## Steps Taken So Far

- Initial mock for `@atproto/api` (failed).
- Exported `login` function from `skysweep.js` and imported it into `login.test.js` (failed).
- Applied more comprehensive mocks for `@atproto/api` (failed).

This refactoring is the next logical step to address the root cause of the testability problem.