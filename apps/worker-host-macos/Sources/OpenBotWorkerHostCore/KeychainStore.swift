import Foundation
import Security

public protocol NodeIdentityStore: Sendable {
    func load(configuration: MacOSNodeConfiguration) throws -> MacOSKeychainEnvelope?
    func save(_ envelope: MacOSKeychainEnvelope, configuration: MacOSNodeConfiguration) throws
    func remove(configuration: MacOSNodeConfiguration) throws
}

public struct SystemNodeIdentityStore: NodeIdentityStore, Sendable {
    public static let service = "com.openbot.worker-host.node-identity"

    private let accessGroup: String

    public init(accessGroup: String) throws {
        guard (try? MacOSAccessGroup.select(from: [accessGroup])) == accessGroup else {
            throw OpenBotMacOSError.invalidAccessGroup
        }
        self.accessGroup = accessGroup
    }

    public func load(configuration: MacOSNodeConfiguration) throws -> MacOSKeychainEnvelope? {
        var query = baseQuery(nodeId: configuration.nodeId)
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnAttributes as String] = true
        query[kSecReturnData as String] = true

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess,
              let attributes = result as? [String: Any],
              let data = attributes[kSecValueData as String] as? Data,
              attributes[kSecAttrService as String] as? String == Self.service,
              attributes[kSecAttrAccount as String] as? String == configuration.nodeId,
              attributes[kSecAttrAccessGroup as String] as? String == accessGroup,
              attributes[kSecAttrAccessible as String] as? String ==
                (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String),
              !booleanAttribute(attributes[kSecAttrSynchronizable as String])
        else {
            throw OpenBotMacOSError.keychainFailure
        }

        let envelope = try MacOSKeychainEnvelope.decodeStrict(data)
        try envelope.requireMatches(configuration)
        return envelope
    }

    public func save(
        _ envelope: MacOSKeychainEnvelope,
        configuration: MacOSNodeConfiguration
    ) throws {
        try envelope.requireMatches(configuration)
        let data = try envelope.encoded()
        var attributes = baseQuery(nodeId: configuration.nodeId)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        attributes[kSecValueData as String] = data

        let addStatus = SecItemAdd(attributes as CFDictionary, nil)
        if addStatus == errSecDuplicateItem {
            let changes: [String: Any] = [
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                kSecValueData as String: data,
            ]
            let updateStatus = SecItemUpdate(
                baseQuery(nodeId: configuration.nodeId) as CFDictionary,
                changes as CFDictionary
            )
            guard updateStatus == errSecSuccess else { throw OpenBotMacOSError.keychainFailure }
        } else if addStatus != errSecSuccess {
            throw OpenBotMacOSError.keychainFailure
        }

        guard try load(configuration: configuration) == envelope else {
            throw OpenBotMacOSError.keychainFailure
        }
    }

    public func remove(configuration: MacOSNodeConfiguration) throws {
        let status = SecItemDelete(baseQuery(nodeId: configuration.nodeId) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw OpenBotMacOSError.keychainFailure
        }
    }

    public func queryForTesting(nodeId: String) -> [String: AnyHashable] {
        baseQuery(nodeId: nodeId).reduce(into: [:]) { result, item in
            if let value = item.value as? AnyHashable { result[item.key] = value }
        }
    }

    private func baseQuery(nodeId: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: nodeId,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: false,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }
}

private func booleanAttribute(_ value: Any?) -> Bool {
    if let value = value as? Bool { return value }
    if let value = value as? NSNumber { return value.boolValue }
    return true
}
