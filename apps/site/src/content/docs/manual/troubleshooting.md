---
title: "Troubleshooting"
description: "Troubleshooting — OpenBot"
---

## The app shows setup every time

The current startup flow checks whether the encrypted bootstrap and database already exist. A retained installation uses a short resume screen. If setup returns after an upgrade, verify you opened the expected app and kept its user profile. Never delete the database or bootstrap as a first troubleshooting step.

## A key or password is requested again

Identify the dialog. Model credentials are configured in Settings. A macOS Keychain dialog is an OS approval, and a Windows sign-in boundary protects DPAPI. Updated unsigned builds can change application trust. Unlock the OS store and retry; the app preserves the existing database if a credential cannot be read.

## A Bot cannot search or use a plugin

Check that the Agent is enabled, the selected model supports tools, the Bot belongs to the channel, and the capability is configured. For a plugin, inspect its enabled state and that Bot's exact grants. A tool name in a prompt or a `readOnlyHint` does not grant access. A changed plugin declaration requires a fresh review.

## A task stops or a file fails

Open task details for the failure category. A timeout, cancelled task or exhausted budget is not a completed result. Split a large task or resubmit after fixing the cause. For files, check size/type limits, choose extraction before asking for text, and supply a PDF password only in attachment processing. Some providers cannot consume binary attachments.

## Report a problem

Use the [bug report form](https://github.com/yxflc11/openbot/issues/new/choose). Include version, platform, expected behavior and minimal reproduction steps. Remove API keys, private transcripts and account data from logs or screenshots. For a security issue, use [private reporting](https://github.com/yxflc11/openbot/security/advisories/new).
