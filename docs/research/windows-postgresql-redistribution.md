# Research: auditable Windows PostgreSQL redistribution

- Status: Implemented source-build adapter; native Windows CI execution pending
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: A Windows Desktop archive ships an explicitly pinned native database runtime with complete applicable notices, verifiable binary/source inventory, and any required library replacement/corresponding-source materials.
- Security boundary: Only read-only archives/source inspection at this stage; no downloaded executable is run locally and no unaudited DLL is declared cleared.

## Search evidence

Existing reuse ledger, Desktop native notices and Windows Desktop completion research were inspected. The npm Windows package `@embedded-postgres/windows-x64` 17.10.0-beta.17 contains only its wrapper MIT license, despite distributing PostgreSQL and multiple independent DLLs. Upstream wrapper commit `c23ad8a026c711c8666c3c2596d0fde643cf378a` was reviewed by the Windows adapter workstream (exact full commit is recorded in that document).

GitHub/primary searches: `PostgreSQL Windows binaries source build meson without openssl icu vcpkg licenses theseus`, `EnterpriseDB PostgreSQL 17.10 Windows third party licenses source code download`.

- [Zonky binary repack source](https://github.com/zonkyio/embedded-postgres-binaries), inspected checkout `c56022003f8b1a6284567c365f44738b7e83514b`: Windows script repacks the EDB ZIP and includes all bin/lib DLLs but excludes doc/license trees. It is a testing-oriented lightweight archive, not a license inventory.
- [EDB download page](https://www.enterprisedb.com/software-downloads-postgres), [modified GPL/source utility page](https://www.enterprisedb.com/modified-gpl), and original Windows 17.10-1 ZIP selected by the upstream recipe.
- [theseus-rs PostgreSQL binaries](https://github.com/theseus-rs/postgresql-binaries) selected for read-only examination as a maintained source-built candidate.
- [PostgreSQL Windows guidance](https://wiki.postgresql.org/wiki/Windows) and [official Meson builds](https://www.postgresql.org/docs/17/install-meson.html).

## Candidate comparison

| Candidate | Pin | Fit | Current decision |
| --- | --- | --- | --- |
| Existing npm/Zonky/EDB repack | 17.10.0-beta.17 / PostgreSQL17.10 | Already integrated; original archive may retain missing notices. | Trace byte correspondence, exact dependent library versions, sources and build modifications before using as public artifact. |
| Original EDB archive | PostgreSQL17.10-1 Windows x64 | Official upstream vendor distribution; substantially larger due optional tools. | Inspect archive notices and source offers; do not assume all prerequisites are satisfied. |
| theseus-rs binary release | `2954f800589f74265f136cdb490b87749e209e7c` | Windows workflow reuses the same EDB binary ZIP. | Rejected: does not close the corresponding-source gap. |
| Official source build | PostgreSQL17.10 source, Meson/MSVC | Can disable unused optional LGPL dependencies; requires actual Windows CI build and runtime tests. | Last option after viable released binary candidates are exhausted. |

## Source incorporation

No third-party implementation copied or run. Any retained license texts must remain unmodified and include exact source URLs and file hashes. Build configuration and binary-specific conclusions will be recorded only after inspection.

## Decision: official source build (2026-09-10)

The EDB ZIP was downloaded and SHA-256 verified locally as `f9aafca58e7026a1ef2caeee711acf761671e57904d430adc85f468374f5a821`. All 121 npm EXE/DLL files match its members byte for byte. Original vendor notices were recovered, but this does not establish the corresponding source of its old MinGW gettext 0.19.8 / iconv 1.15 binaries. EDB installer source `a85996bfa15066a2f3c66c3cc35ec59e13dc9942` confirms copying these binaries from a prebuilt gettext directory. [Upstream bug 18668](https://www.postgresql.org/message-id/18668-6d1114a7c779256c%40postgresql.org) independently records the unexpected iconv version. No license-clearance assertion is made for this rejected archive. Audit hashes and untouched vendor notices are retained under `licenses/windows-postgresql/rejected-edb/` as evidence only.

The maintained alternative theseus-rs checkout `2954f800589f74265f136cdb490b87749e209e7c` also downloads EDB's Windows ZIP in its workflow. It does not solve this gap. OpenBot therefore uses the next viable option: an unmodified official PostgreSQL source release and its released Meson build system, with a thin PowerShell download/build/inventory adapter. No database implementation is forked.

Pinned inputs:

- PostgreSQL **17.10** official `postgresql-17.10.tar.bz2`, SHA-256 `078a03516dcdbdb705fecaf415ea3d13a956c589e46f09fed68a06fb00598c90`, independently equal to the official adjacent `.sha256` file. Inspected `meson.build`, `meson_options.txt`, Windows port headers, regression tests, source notices and [official Windows build guidance](https://wiki.postgresql.org/wiki/Windows). This retains the database major/minor currently selected by Desktop; it is not a claim to be the latest PostgreSQL patch.
- Meson **1.9.1**, source commit `751b09390996163348612f0b106114256305ee40`, Apache-2.0. Inspected Windows compiler/runtime options, VS environment detection, unit tests and release notes. Pure Python wheel SHA-256 `f824ab770c041a202f532f69e114c971918ed2daff7ea56583d80642564598d0`.
- Ninja **1.13.2**, source commit `3441b633c2fe2c494e958780ba0f4227b1327634`, Apache-2.0. Inspected Windows process tests and release issues; avoids the Windows linker issue fixed after 1.13.0. Official `ninja-win.zip` SHA-256 `07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65`.
- WinFlexBison **2.5.25**, source commit `1176da2adaf972b2216b1ac8dd611e128fe80bc5`. Official ZIP SHA-256 `8d324b62be33604b2c45ad1dd34ab93d722534448f55a16ca7292de32b6ac135`. Inspected Bison skeleton license/exception, Flex license, source, changes and build configuration. These are build tools only; generator executable/DLL files are not shipped. Generated parser notices and Bison output exception are preserved.
- MSVC and Perl are supplied by the Windows runner/developer toolchain, recorded with their actual versions and runner image in each artifact manifest. They are not silently presented as reproducible byte-for-byte build inputs.

Use the official `--auto-features=disabled`, `-Dssl=none`, `-Duuid=none` options to exclude NLS/gettext/iconv, ICU, XML/XSLT, readline, external procedural-language runtimes, compression libraries and JIT. UTF-8, JSON, SQL/PLpgSQL and built-in SCRAM remain available. The runtime binds loopback only; it does not advertise TLS or ICU features. `-Db_vscrt=mt` statically links the Microsoft C runtime under the licensed MSVC toolchain, avoiding separately copied runtime DLLs. [Microsoft build/redistribution guidance](https://learn.microsoft.com/en-us/visualstudio/releases/2022/redistribution) and the [MSVC licensing guidance](https://www.microsoft.com/licensing/guidance/Visual-Studio) were reviewed. Windows OS DLLs remain system prerequisites. This configuration requires actual Windows smoke/regression testing before release claims.

The build adapter verifies every downloaded input before extraction/execution, uses a disposable tool venv, records exact compiler/tool versions, preserves PostgreSQL and embedded-source notices, inventories every staged file, and refuses any runtime DLL import outside its own PostgreSQL outputs or Windows system libraries. Staging accepts only this manifest-backed source build. CI retains the source archive and manifest alongside the unsigned installer so recipients can inspect and rebuild the same unmodified source without asking OpenBot for a private copy.

## Selected patch update: PostgreSQL 17.11

Before the first Windows binary was built, the source-build target was updated to **17.11**, released 2026-08-13, matching the current CI database patch. [Official release notes](https://www.postgresql.org/docs/release/17.11/) were read: fixes include server memory-safety flaws, SQL privilege/plan-cache issues, psql scripted-input hazards and SCRAM mock-secret consistency. The release states no dump/restore is required for 17.x, while some optional extension/configuration cases need extra maintenance. OpenBot does not install the affected optional btree_gist/ltree extensions or configure logical-replication output plugins.

The official 17.11 source archive SHA-256 is `dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979`, verified from downloaded bytes and the adjacent official checksum file. Its Meson options, embedded notices and regression suite were re-inspected. The earlier 17.10 source pin above records candidate review history; **only 17.11 is accepted by Windows release staging**. Existing macOS pins are unchanged.

A Windows CI upgrade fixture uses the original hash-pinned EDB 17.10 ZIP only inside the disposable runner to initialize a synthetic UTF-8/C-locale cluster. It then stops that server, opens the same cluster with the selected 17.11 source build and verifies retained JSON/Unicode/PLpgSQL data plus a further restart. No old binary is copied to runtime output or CI release artifacts. This validates the actual minor-version upgrade path without distributing the rejected binary candidate. Tests do not access any user profile.

## Verification before Windows CI

- Downloaded source bytes and official checksum agree for 17.11; retained notice files were regenerated from that exact source, including 104 verbatim embedded license/public-domain comment blocks.
- Both new PowerShell scripts were parsed successfully with the actual PowerShell 7.5.4 parser. For local syntax checking only, the official macOS ARM64 archive was verified against GitHub's release SHA-256 `3aaadd7ca62f1e4dbe59145b6af24e926d61f8da8a4782bc535e500c184135f0`. No Windows script or Windows executable was run on macOS.
- Actual MSVC compilation, PostgreSQL regression, 17.10-to-17.11 retained-cluster test and Desktop NSIS/lifecycle conformance run on Windows CI. Until those jobs pass for the selected commit, these remain execution gates rather than completed native-validation claims.

The Windows compiler environment selects `CC=cl.exe` after `VsDevCmd` adds the reviewed toolchain to PATH. The actual compiler path and binary hash are still recorded. Meson 1.9.1 source `environment.py` checks whether an environment value names an existing path before command-string splitting, so the prior full path was not established to be a defect. Using the already-selected executable name is a simpler toolchain-compatible input; the recorded full-path hash still identifies it. No compiler/source change is involved.
