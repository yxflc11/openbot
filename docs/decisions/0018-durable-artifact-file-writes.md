# ADR-0018: Reuse maintained atomic writes for result artifacts

- Status: Accepted
- Date: 2026-09-04

## Context

The first file-backed artifact store wrote a random temporary file and renamed it into place. The
normal path was atomic, but a failure after the temporary write and before the rename left that
temporary file outside the rollback list. A screenshot can contain private information, so an
unreferenced file is a security and lifecycle defect rather than harmless cache residue.

OpenBot needs an append-only file result today and an object-storage adapter later. It does not need
to own a general atomic-file implementation.

## Upstream review

- [`npm/write-file-atomic` 8.0.0](https://github.com/npm/write-file-atomic/tree/v8.0.0) (ISC) is
  maintained by npm, supports this repository's exact Node.js engine range, writes and fsyncs a
  temporary file, renames it into place, removes the temporary file on failure, and serializes
  concurrent writes to one destination. OpenBot uses the released package and its public Promise
  API.
- [`image-js/fast-png` 8.0.0](https://github.com/image-js/fast-png/tree/v8.0.0) (MIT) can decode PNG
  and check chunk CRCs, but decoding alone does not define a bounded untrusted-image policy.
- [`sharp` 0.35.0](https://github.com/lovell/sharp/tree/v0.35.0) (Apache-2.0) provides corruption and
  pixel-count limits and can re-encode images without retaining input metadata. It remains the
  preferred validation candidate, but adding native binaries changes Server packaging and must be
  tested on the Linux x64/arm64 release matrix first.

No upstream source was copied or substantially adapted.

## Decision

1. Depend on `write-file-atomic` 8.0.0 instead of maintaining temporary-name, write, rename, fsync,
   and cleanup behavior locally.
2. Keep random append-only storage keys and explicit `0600` file mode. A test verifies the final
   permission bits as well as read and removal behavior.
3. Keep the existing byte, base64, media type, and PNG-signature checks as the current minimum. Do
   not claim that an eight-byte signature proves a well-formed or safe PNG.
4. Defer full image decoding and normalization until the selected decoder has resource limits and
   repeatable Linux x64/arm64 packaging evidence. The artifact endpoint stays authenticated,
   non-cacheable, same-origin, and `nosniff` in the meantime.
5. Treat the configured artifact root as a trusted operator boundary. Symlink-resistant traversal
   and an object-store adapter remain required before less-trusted processes can write inside that
   directory tree.
6. A follow-up [Artifact read-integrity review](../research/artifact-read-integrity.md) adopts OCI's
   descriptor rule: verify the authoritative size and SHA-256 before returning stored bytes. A
   mismatch fails closed and is not served to the Client.

## Consequences

- A failed local artifact write no longer relies on OpenBot's incomplete temporary-file cleanup.
- The direct dependency and transitive `signal-exit` dependency are recorded by the lockfile and
  normal dependency audit.
- Result files remain private by mode and recoverable by their database storage key; accidental
  replacement or corruption is detected at the authenticated read boundary.
- A malformed file beginning with a PNG signature can still be accepted. This limitation remains
  explicit until bounded decode-and-normalize validation is implemented.
