---
title: "Models, credentials and preferences"
description: "Models, credentials and preferences — OpenBot"
---

Settings configure the model provider and connection used by the Server. Save a provider API key once; later edits can retain the stored key. The UI does not read the raw stored secret back. Explicitly enable the Agent before inference can run. A configured key alone is not an instruction to spend tokens.

Choose a model appropriate for tool calls and the file types you need. Provider compatibility differs: text completion alone does not prove tool or image/PDF support. Connection errors distinguish rejected credentials, rate limiting and unavailable models. Do not paste a password into a task to repair configuration.

## Credential persistence

Local Desktop keeps its bootstrap credential encrypted using the operating system's storage facility: Windows DPAPI or macOS Keychain. Model settings and plugin connection tokens are retained on the Server. Restarting the application reuses these files; the normal startup screen does not ask you to reconfigure the model.

A macOS “Safe Storage” prompt asks for the system login Keychain password, not your model API key. A changed unsigned preview build may require OS approval again. Application code cannot promise to remove that operating-system approval without a stable signing identity. Keep the existing data profile when upgrading; do not delete credential files to silence a prompt.

## Workspace preferences

Appearance, sidebar visibility, detail panels, text size, time display, reduced motion and send shortcuts are workspace controls. They do not change Bot authority. For remote connections, verify the Server URL before saving it; the client does not transfer a local workspace just because you changed the connection.
