import Foundation
import Security
import Testing
@testable import OpenBotWorkerHostCore

private let credential = "obn_" + String(repeating: "a", count: 43)
private let enrolledAt = "2026-09-04T00:00:00.000Z"

@Test func strictConfigurationAndServerEndpoint() throws {
    let configuration = try MacOSNodeConfiguration(
        nodeId: "mac-node-1",
        serverUrl: "wss://openbot.example/ws/nodes"
    )
    #expect(try MacOSNodeConfiguration.decodeStrict(configuration.encoded()) == configuration)
    #expect(try enrollmentEndpoint(for: configuration.serverUrl).absoluteString ==
        "https://openbot.example/api/v1/nodes/enroll")

    let extra = Data(#"{"format":"openbot.macos-node-config/v1","nodeId":"mac-node-1","serverUrl":"wss://openbot.example/ws/nodes","maxConcurrentRuns":1,"logLevel":"info","credential":"secret"}"#.utf8)
    #expect(throws: OpenBotMacOSError.invalidConfiguration) {
        try MacOSNodeConfiguration.decodeStrict(extra)
    }
    #expect(throws: OpenBotMacOSError.invalidConfiguration) {
        try MacOSNodeConfiguration(nodeId: "mac-node-1", serverUrl: "ws://openbot.example/ws/nodes")
    }
}

@Test func keychainEnvelopeBindsNodeAndServer() throws {
    let identity = try NodeIdentity(
        nodeId: "mac-node-1",
        credential: credential,
        enrolledAt: enrolledAt
    )
    let envelope = try MacOSKeychainEnvelope(
        serverUrl: "wss://openbot.example/ws/nodes",
        identity: identity
    )
    #expect(try MacOSKeychainEnvelope.decodeStrict(envelope.encoded()) == envelope)
    try envelope.requireMatches(
        MacOSNodeConfiguration(nodeId: "mac-node-1", serverUrl: envelope.serverUrl)
    )
    #expect(throws: OpenBotMacOSError.invalidIdentity) {
        try envelope.requireMatches(
            MacOSNodeConfiguration(nodeId: "mac-node-1", serverUrl: "wss://other.example/ws/nodes")
        )
    }

    let nestedExtra = Data(#"{"format":"openbot.macos-keychain-node/v1","serverUrl":"wss://openbot.example/ws/nodes","identity":{"format":"openbot.node-identity/v1","nodeId":"mac-node-1","credential":"obn_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","enrolledAt":"2026-09-04T00:00:00.000Z","extra":true}}"#.utf8)
    #expect(throws: OpenBotMacOSError.invalidIdentity) {
        try MacOSKeychainEnvelope.decodeStrict(nestedExtra)
    }
}

@Test func accessGroupSelectionIsExactAndUnambiguous() throws {
    let expected = "A1B2C3D4E5.com.openbot.worker-host.shared"
    #expect(try MacOSAccessGroup.select(from: ["A1B2C3D4E5.other", expected]) == expected)
    #expect(throws: OpenBotMacOSError.invalidAccessGroup) {
        try MacOSAccessGroup.select(from: [])
    }
    #expect(throws: OpenBotMacOSError.invalidAccessGroup) {
        try MacOSAccessGroup.select(from: [expected, expected])
    }
    #expect(throws: OpenBotMacOSError.invalidAccessGroup) {
        try MacOSAccessGroup.select(from: ["short.com.openbot.worker-host.shared"])
    }
}

@Test func keychainQueryIsFixedAndDataProtectionOnly() throws {
    let group = "A1B2C3D4E5.com.openbot.worker-host.shared"
    let store = try SystemNodeIdentityStore(accessGroup: group)
    let query = store.queryForTesting(nodeId: "mac-node-1")
    #expect(query[kSecClass as String] as? String == kSecClassGenericPassword as String)
    #expect(query[kSecAttrService as String] as? String == SystemNodeIdentityStore.service)
    #expect(query[kSecAttrAccount as String] as? String == "mac-node-1")
    #expect(query[kSecAttrAccessGroup as String] as? String == group)
    #expect(query[kSecAttrSynchronizable as String] as? Bool == false)
    #expect(query[kSecUseDataProtectionKeychain as String] as? Bool == true)
}

@Test func childLaunchPolicyHasNoCredentialOrMutableCommand() throws {
    let policy = try NodeChildLaunchPolicy(
        applicationRoot: URL(fileURLWithPath: "/Applications/OpenBot Worker Host.app"),
        homeDirectory: URL(fileURLWithPath: "/Users/openbot"),
        workDirectory: URL(fileURLWithPath: "/Users/openbot/Library/Application Support/OpenBot/Node/work")
    )
    #expect(policy.executable == "/Applications/OpenBot Worker Host.app/Contents/Resources/node/bin/node")
    #expect(policy.arguments == [
        "--jitless",
        "/Applications/OpenBot Worker Host.app/Contents/Resources/node/app/index.js",
    ])
    #expect(policy.environment == ["HOME": "/Users/openbot"])
    #expect(!String(describing: policy).contains("obn_"))
}
