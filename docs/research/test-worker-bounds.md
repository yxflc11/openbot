# Research: bounded test workers

- Status: Accepted
- Date: 2026-09-10
- Existing toolchain: Vitest 4.1.11, release commit 9bd8d46, MIT; no dependency change or copied source.

Reviewed the [official maxWorkers contract](https://vitest.dev/config/maxworkers.html), [release and maintained tests](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11), and installed worker configuration. The default uses all available parallelism for each independent workspace. Turbo starts multiple workspaces; the new Office/OCR worker tests compete with socket liveness tests, producing a five-second disk test timeout under the full suite while focused tests pass. Use the released `--maxWorkers=4` option for Server and Web tests and run at most two workspace test jobs concurrently. Preserve test isolation and production deadlines. This is a resource bound, not a retry or timeout increase; the full suite must pass without suppressing failures.

## Native Windows ACL integration budget

CI run 34483934167 passed Server tests but the Desktop native DACL test hit Vitest's default 5-second whole-test limit. This test starts four real Windows PowerShell processes sequentially; each production invocation already has a 15-second fail-closed deadline. The [official per-test timeout contract](https://vitest.dev/config/testtimeout) in the same reviewed Vitest 4.1.11 permits a narrow integration budget. Set this one test to 65 seconds (four existing 15-second bounds plus fixture cleanup), without changing production deadlines, mocking ACLs, retries, or global test timeouts. Hosted Windows must still complete and validate every retained/inherited ACL assertion. No source copied or dependency added.
