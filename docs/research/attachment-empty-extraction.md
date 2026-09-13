# Research: empty attachment extraction

- Status: Accepted before implementation
- Date: 2026-09-13
- Acceptance journey: extracting an image-only PDF reports that no readable text was found;
  it does not mark the file as extracted or silently replace the original with whitespace.
- Security boundary: channel-scoped immutable bytes and digest-bound derived text remain Server
  owned. No OCR service, binary upload, grant, parser dependency, or file mutation is added.

## Search evidence

GitHub queries: `repo:mozilla/pdf.js scanned getTextContent` and
`repo:naptha/tesseract.js PDF not supported`. Checked the existing PDF/Office parser entry in
[the reuse ledger](../OPEN_SOURCE_REUSE.md) and
[the pinned parser review](pdfjs-6.3-lock-coherence.md).

Primary sources inspected:

- [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) and
  [pinned display API source](https://github.com/mozilla/pdf.js/blob/1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56/src/display/api.js).
  Text extraction exposes page text items; it is not proof of OCR or complete document coverage.
- [PDF.js issue 16233](https://github.com/mozilla/pdf.js/issues/16233) illustrates why text extraction
  and a document being searchable cannot be treated as interchangeable. No issue attachment copied.
- [Tesseract.js v7 FAQ](https://github.com/naptha/tesseract.js/blob/42eae669e4b3a66429d8516f078912cc747a89df/docs/faq.md)
  states that PDFs require a separate rendering step. Existing offline image OCR remains unchanged.
- Installed exact PDF.js distribution and OpenBot real Worker tests for encrypted PDF, PDF actions,
  Office containers, and offline OCR inspected. A locally authored image-only PDF reproduces the
  defect: one synthetic newline is persisted as successful extraction and suppresses the binary part.

## Candidate comparison

| Candidate | Exact release / commit | License | Maintenance, tests, fit | Decision |
| --- | --- | --- | --- | --- |
| PDF.js | 6.3.289 / `1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56` | Apache-2.0 | Current locked dependency; real Worker tests; Node/macOS/Windows parser boundary unchanged | Reuse extraction result through a narrow validation adapter |
| Tesseract.js | 7.0.0 / `42eae669e4b3a66429d8516f078912cc747a89df` | Apache-2.0 | Current locked dependency; offline raster test; PDF input needs rendering and additional resource bounds | Keep existing PNG/JPEG OCR; do not add PDF OCR in this fix |

## Reuse decision

Reuse existing parsers. The local gap is application success semantics: whitespace-only output
must not become a usable extracted attachment. Reject it before derived storage. PDF errors explain
that the document may be scanned or blank and suggest uploading PNG/JPEG pages for explicit image
OCR. Other empty outputs report no readable text. Do not label every empty file a scanned document.

Previously stored empty derived records must fail before inference, with a re-upload/extraction
instruction. Do not silently switch those records to a binary model upload: that could change the
material sent to a provider. Valid derived text, original bytes, and permissions are unchanged.

No source copied or substantially adapted. Existing dependency notices remain in place.

## Verification plan and limits

Use real image-only PDF bytes through the storage/service and route-handler boundary;
assert failure, no processing metadata, and unchanged original digest. Test legacy whitespace records
are rejected before inference, normal extracted text still works, and cancellation/password tests
remain green. Run the full repository check. This does not prove scanned-PDF OCR, mixed-page coverage,
real microphone capture, or native GUI behavior while the Mac is locked.
