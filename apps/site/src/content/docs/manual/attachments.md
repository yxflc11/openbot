---
title: "Files, OCR and voice"
description: "Files, OCR and voice — OpenBot"
---

Add files from the composer, by dropping them onto it, or by pasting an image. Up to eight files and 20 MiB total can accompany a message. Each text/code file is limited to 256 KiB, each PNG/JPEG to 5 MiB, and each document/audio/video to 10 MiB. Originals are stored in the channel and checked with SHA-256.

| File | Available action |
| --- | --- |
| UTF-8 text and code | Read bounded pages in the current task |
| DOCX, XLSX, PPTX, ODT, ODS, ODP | Extract text locally |
| PDF | Extract text locally; supply a transient password if encrypted |
| PNG and JPEG | Recognize English and simplified Chinese text locally |
| MP3, WAV, M4A, MP4 and WebM | Explicitly transcribe through the configured OpenAI connection |

Open **Attachment actions** to extract, recognize or transcribe before sending a task that needs the contents. Derived text is bound to the original file's digest. Extraction has time, memory and output limits; a truncated result is labeled. Macros, arbitrary embedded files and active document code are not executed. Scanned PDFs do not automatically receive OCR; export a page as PNG/JPEG to recognize it.

## Record a voice attachment

Click the microphone, allow microphone access, record, then stop. The recording is limited to five minutes and 10 MiB. Listen before choosing **Add to draft**, or discard it. Leaving the channel stops microphone tracks. Recording does not automatically transmit audio to a model. To transcribe, explicitly choose the attachment's transcription action; this sends the selected media to your enabled OpenAI provider.

## Download and retention

Use **Download original** for immutable source bytes. Desktop uses a controlled native Save dialog. The composer menu's **Channel files** opens available files and the recycle bin. Soft deletion hides an attachment from new work; existing tasks retain access. Restore it to use it again. Cleanup considers items deleted at least seven days ago and retains anything still referenced by a message or task.
