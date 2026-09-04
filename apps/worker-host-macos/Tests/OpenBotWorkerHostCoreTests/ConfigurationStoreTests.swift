import Darwin
import Foundation
import Testing
@testable import OpenBotWorkerHostCore

@Test func configurationStoreWritesAndReadsOnePrivateFixedFile() throws {
    let root = FileManager.default.temporaryDirectory
        .appendingPathComponent("openbot-macos-config-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: root.path)

    let store = try MacOSConfigurationStore(homeDirectory: root)
    let configuration = try MacOSNodeConfiguration(
        nodeId: "mac-node-1",
        serverUrl: "wss://openbot.example/ws/nodes"
    )
    try store.save(configuration)
    #expect(try store.load() == configuration)
    try store.ensureWorkDirectory()

    var metadata = stat()
    #expect(lstat(store.configurationURL.path, &metadata) == 0)
    #expect((metadata.st_mode & 0o777) == 0o600)
    #expect(metadata.st_nlink == 1)
    try store.remove()
    #expect(!FileManager.default.fileExists(atPath: store.configurationURL.path))
}

@Test func configurationStoreRejectsLooseOrLinkedFiles() throws {
    let root = FileManager.default.temporaryDirectory
        .appendingPathComponent("openbot-macos-config-negative-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: root.path)
    let store = try MacOSConfigurationStore(homeDirectory: root)
    let configuration = try MacOSNodeConfiguration(
        nodeId: "mac-node-1",
        serverUrl: "wss://openbot.example/ws/nodes"
    )
    try store.save(configuration)
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: store.configurationURL.path)
    #expect(throws: OpenBotMacOSError.invalidConfiguration) { try store.load() }

    try FileManager.default.removeItem(at: store.configurationURL)
    let target = root.appendingPathComponent("target.json")
    try configuration.encoded().write(to: target)
    try FileManager.default.createSymbolicLink(at: store.configurationURL, withDestinationURL: target)
    #expect(throws: OpenBotMacOSError.unavailableConfiguration) { try store.load() }
}
