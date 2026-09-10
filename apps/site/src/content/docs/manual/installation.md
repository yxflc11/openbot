---
title: "Install OpenBot"
description: "Install OpenBot — OpenBot"
---

OpenBot Desktop runs a private workspace on your computer or connects to an existing OpenBot Server. This release adds the Windows x64 desktop path. A model provider is configured separately; installing the app does not start paid inference.

## Windows

1. Open [GitHub releases](https://github.com/yxflc11/openbot/releases) and select the current Windows x64 `.exe`. Check its filename and SHA-256 against the release's `SHA256SUMS`.
2. Run the per-user installer and open OpenBot from the Start menu. Administrator rights are not needed for the local Desktop workspace.
3. Choose **As the Server computer** to keep the database and Server on this machine, or **Connect to a Server** for an existing deployment.
4. On first use, OpenBot prepares its bundled PostgreSQL and local Server. No Docker or separately installed Node.js is required.
5. Open Settings, select a model provider, save the API key and model, and explicitly enable the Agent. Create your first Bot and channel.

An unsigned preview may produce a Windows trust prompt. OpenBot does not bypass operating-system policy. Windows ARM64 and automatic computer-control enrollment are not included in this installer.

## Returning to your workspace

Normal launches reuse the saved installation, encrypted bootstrap identity, model settings and database. A short connection screen replaces the first-install checklist. Keep the same user profile and application data when upgrading. Quit the app before copying database files for a backup. Uninstalling the app does not erase workspace data.

The desktop client can also connect to a separately hosted Server over its reviewed URL. Localhost always means the Server machine for tools and plugins. See the [Windows engineering contract](https://github.com/yxflc11/openbot/blob/main/docs/WINDOWS_DESKTOP.md) for platform evidence and packaging details.
