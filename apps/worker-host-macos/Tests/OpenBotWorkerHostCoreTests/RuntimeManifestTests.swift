import CryptoKit
import Darwin
import Foundation
import Testing
@testable import OpenBotWorkerHostCore

@Test func runtimeManifestValidatesExactFilesAndRejectsTampering() throws {
    let root = FileManager.default.temporaryDirectory
        .appendingPathComponent("openbot-macos-manifest-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }

    let entryURL = root.appendingPathComponent("Contents/Resources/node/app/index.js")
    let nodeURL = root.appendingPathComponent("Contents/Resources/node/bin/node")
    let manifestURL = root.appendingPathComponent(WorkerHostRuntimeManifest.manifestRelativePath)
    try FileManager.default.createDirectory(
        at: entryURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try FileManager.default.createDirectory(
        at: nodeURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )

    let entry = Data("console.log('openbot')\n".utf8)
    let node = Data("test-node-binary\n".utf8)
    try entry.write(to: entryURL)
    try node.write(to: nodeURL)
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: entryURL.path)
    try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: nodeURL.path)

    let manifest: [String: Any] = [
        "format": WorkerHostRuntimeManifest.formatValue,
        "version": "0.0.0-test",
        "sourceCommit": String(repeating: "a", count: 40),
        "architecture": "arm64",
        "files": [
            [
                "path": WorkerHostRuntimeManifest.requiredPaths[0],
                "sha256": sha256(entry),
                "size": entry.count,
                "mode": "0644",
            ],
            [
                "path": WorkerHostRuntimeManifest.requiredPaths[1],
                "sha256": sha256(node),
                "size": node.count,
                "mode": "0755",
            ],
        ],
    ]
    try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        .write(to: manifestURL)
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: manifestURL.path)

    let loaded = try WorkerHostRuntimeManifest.loadAndValidate(
        applicationRoot: root,
        expectedOwner: getuid()
    )
    #expect(loaded.files.count == 2)

    try Data("tampered\n".utf8).write(to: entryURL)
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: entryURL.path)
    #expect(throws: OpenBotMacOSError.invalidBundle) {
        try WorkerHostRuntimeManifest.loadAndValidate(
            applicationRoot: root,
            expectedOwner: getuid()
        )
    }
}

private func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}
