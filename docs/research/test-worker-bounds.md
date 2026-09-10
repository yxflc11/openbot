# Research: bounded test workers

- Status: Accepted
- Date: 2026-09-10
- Existing toolchain: Vitest 4.1.11, release commit 9bd8d46, MIT; no dependency change or copied source.

Reviewed the [official maxWorkers contract](https://vitest.dev/config/maxworkers.html), [release and maintained tests](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11), and installed worker configuration. The default uses all available parallelism for each independent workspace. Turbo starts multiple workspaces; the new Office/OCR worker tests compete with socket liveness tests, producing a five-second disk test timeout under the full suite while focused tests pass. Use the released `--maxWorkers=4` option for Server and Web tests and run at most two workspace test jobs concurrently. Preserve test isolation and production deadlines. This is a resource bound, not a retry or timeout increase; the full suite must pass without suppressing failures.
