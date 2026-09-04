# Research: Windows Worker Host transactional installer

- Status: Accepted platform contract; authoring tool requires Owner license decision
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G4 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: An administrator installs or upgrades one per-machine package; Windows
  Installer stops the old OpenBot service, transactionally replaces its reviewed files and service
  configuration, starts only when explicitly requested by a later credential-aware bootstrap, and
  restores the prior installed state if a standard action fails.
- Security boundary: The package may write only the fixed Program Files release, an independently
  retained ProgramData state root, and one fixed SCM service. It cannot enroll a Node, receive a
  credential in an MSI property or command line, choose another executable/account, grant ordinary
  users service mutation rights, download content, disable rollback, or become an identity or
  authorization authority. Package, ACL, service, signature, or rollback uncertainty fails closed.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `wixtoolset/wix releases v7`, `WiX v6 service install rollback`, `WiX ServiceInstall
  LocalService upgrade`, `electron wix msi service`, and current WiX issue/release/source/license
  inspection. WiX `v7.0.0` resolves to commit
  `b8977d6f88e7b68e000bac226a2814f236770570`; WiX v3 is archived and unsupported.
- Standards and primary documentation queries: Microsoft Windows Installer `ServiceInstall`,
  `ServiceControl`, `MsiServiceConfig`, `MsiServiceConfigFailureActions`,
  `MsiLockPermissionsEx`, component rules, major upgrades, `RemoveExistingProducts`, rollback,
  custom-action security, SCM service SIDs, LocalService, and service-object access rights; Microsoft
  MSIX packaged-service platform and restricted-capability limits; WiX v7 release, license, OSMF
  EULA, lifecycle, schema, and validation documentation.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `docs/EXECUTION_PLAN.md`, ADR-0034
  through ADR-0036, Windows service and build-lane research, the Linux recoverable transaction, and
  both open-source reuse ledgers. No Windows installer project or accepted authoring tool existed.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Windows Installer 5.0 standard service tables | Microsoft `ServiceInstall`, `ServiceControl`, `MsiServiceConfig`, `MsiServiceConfigFailureActions`, `MsiLockPermissionsEx`, component, upgrade, and rollback contracts | Windows platform/API documentation | Stable inbox transaction engine with ICE validation. Microsoft documents transactional file rollback, service install/control, service SID and required-privilege configuration, and fail-on-invalid ACL behavior. | Supplies the narrow per-machine transaction OpenBot needs without a self-installing service or privileged custom action. It does not author an MSI, sign it, store credentials, or prove native behavior. | Select as the platform contract. Use standard actions only for the first installer. |
| WiX Toolset | [`v7.0.0` / `b8977d6f`](https://github.com/wixtoolset/wix/tree/b8977d6f88e7b68e000bac226a2814f236770570) | Source under MS-RL; binary release under OSMF EULA v1.1 | Current annual release, active source and tests, 3,548 commits at review, and maintained MSI schema/MSBuild tooling. Consumer security updates cover current and previous major releases. | Technically the first viable thin authoring adapter for the selected MSI tables. The binary requires an explicit EULA gesture and may require a maintenance fee based on project revenue; OpenBot cannot accept that on an Owner's behalf. | Conditionally select only after the Owner confirms the EULA/fee position. Do not download, add, or execute the binary before that decision. |
| WiX Toolset v6 | `v6.0.2`, published 2025-08-28 | MS-RL source plus OSMF v1.0 terms for release use | Maintained security fixes end 2027-02-05; older than v7 and carries the same unresolved maintenance-fee boundary. | Similar authoring fit but shorter remaining security window and no licensing advantage. | Reject for a new integration. |
| MSIX packaged service | Windows 10 2004+ / Windows Server 2022+ packaged-service contract | Windows platform and tooling terms | Microsoft-maintained deployment stack with package integrity and transactional updates. | Requires admin install plus a restricted `packagedServices` capability, lacks service support on older Windows Server, and packaged apps do not fit the existing single-file/unpackaged host and enterprise baseline without a larger identity/container redesign. | Defer; reconsider only for a separately scoped modern-Windows distribution. |
| Service self-install or `sc.exe`/PowerShell installer | .NET 10 / Windows inbox SCM tools | MIT runtime / Windows platform terms | Stable primitives but OpenBot would own transaction journals, quoting, ACLs, repair, upgrade, rollback, cancellation, and partial-failure cleanup. | Useful only as a controlled native test harness. Microsoft recommends standard installer actions where sufficient, and state-changing custom actions require paired rollback handling. | Reject as the shipping installer. A bounded harness may exercise native evidence but may not be distributed as the installer. |
| Electron WiX wrappers | `electron-wix-msi` and `electron-installer-windows` current repositories | MIT plus downstream tool terms | Maintained for Electron application packaging and based on older/general WiX flows. | OpenBot ships a .NET service plus Node runtime, not Electron. The wrappers widen generated authoring and do not close service SID, ACL, rollback, or credential boundaries. | Reject. |

## Reuse decision

- Selected option: open platform standard followed by a thin released authoring adapter.
- Selected upstream or standard: Windows Installer 5.0 standard tables and rollback semantics. WiX
  `v7.0.0` at `b8977d6f88e7b68e000bac226a2814f236770570` is the technical authoring candidate, but binary
  use remains gated on an explicit Owner OSMF EULA/fee decision.
- Why this is the first viable option: Windows Installer already owns component reference counting,
  service sequencing, cancellation, repair, and rollback. Standard tables can express the service,
  service SID, required privileges, failure actions, and ACLs without executing OpenBot code as an
  administrator. MSIX changes the support floor and package identity model; local scripts or
  self-install add a larger privileged transaction engine.
- Exact OpenBot-specific gap: Author a fixed x64 per-machine package, immutable service/file/state
  policy, major-upgrade rules, and package-table assertions; connect it to the existing reviewed
  host output; then prove install/repair/upgrade/rollback/uninstall on controlled Windows. Enrollment
  and Credential Manager remain a separate workflow and never become MSI properties.
- Upgrade, replacement, or exit plan: Keep all package intent in declarative MSI-standard rows and
  test the compiled database, so another maintained authoring tool can replace WiX without changing
  service policy. Review each WiX major release and its license/security window independently.
- Failure behavior when the upstream is missing, incompatible, or compromised: The package is not
  built or released. CI cannot fall back to a floating tool, archived WiX v3, an unsigned installer,
  `sc.exe`, a self-install switch, custom actions, disabled rollback, or an earlier MSI artifact.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: none. This slice records standards, candidates, and the exact gap;
  no WiX binary, NuGet package, schema source, example XML, or upstream test is added.
- Required copyright or license notice location: If approved, record the exact WiX package graph,
  hashes, MS-RL notice, and OSMF EULA decision in the reuse ledger and build record. The generated
  MSI must carry OpenBot's existing third-party notices for shipped runtime components.

## Verification plan

- Automated tests: Statically assert one per-machine x64 package, fixed manufacturer/product/service
  identities, no custom action or network table, no credential-bearing property, fixed Program
  Files and retained ProgramData roots, LocalService, non-interactive own-process service, demand
  start before enrollment, vital install, standard stop/delete controls, service SID, bounded
  failure actions, required privileges, explicit service/file/state DACLs, major-upgrade protection,
  rollback enabled, and deterministic input inventory. Inspect the compiled MSI tables, not XML
  alone, and fail every ICE validation warning or error.
- Negative and fail-closed tests: Reject per-user scope, install-path overrides, arbitrary service
  arguments, LocalSystem/NetworkService/custom accounts, passwords, public MSI properties that can
  carry secrets, ordinary-user service change/start/stop rights, mutable Program Files ACLs, deletion
  of credential/state data, same-version/downgrade installs, custom actions, web downloads, disabled
  rollback, missing signatures, and unexpected tables/files.
- Platforms and devices: First compile and database inspection on pinned `windows-2025`; then fresh
  controlled Windows x64 install, query, repair, upgrade, injected-failure rollback, reboot,
  uninstall, locked-file, non-admin, and Group Policy cases. Windows arm64 remains unclaimed.
- User-visible documentation and translations: Keep both execution plans, reuse ledgers, installer
  operator guide, support matrix, and uninstall/data-retention language aligned.
- Support level that the evidence permits: Platform contract only. No authoring dependency or MSI is
  approved, built, signed, installed, or supported. The current host remains experimental.

## Unresolved questions

- The Owner must decide whether OpenBot may accept and comply with the WiX v7 OSMF EULA and any
  applicable maintenance fee. This is legal/commercial authorization, not covered by approval to
  create repository commits.
- Native sequencing must prove that the `NT SERVICE\\OpenBotNode` service SID can receive the exact
  state-directory rights through standard MSI actions without a custom action. If it cannot, prefer
  a fixed precomputed SID plus compiled-table/native verification or reconsider the identity/layout;
  do not silently grant the shared LocalService SID broad write access.
- Authenticode certificate custody, timestamp authority, reproducible MSI cabinets, SBOM/provenance,
  distribution, and credential-aware first start remain separate reviews.
