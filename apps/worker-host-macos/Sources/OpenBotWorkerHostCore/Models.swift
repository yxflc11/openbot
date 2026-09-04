import Foundation

public enum OpenBotMacOSError: Error, Equatable, Sendable {
    case invalidConfiguration
    case invalidIdentity
    case invalidAccessGroup
    case unavailableConfiguration
    case unavailableIdentity
    case keychainFailure
    case enrollmentFailure
    case registrationFailure
    case invalidBundle
    case childFailure
    case invalidControlRequest
}

public func isValidEnrollmentToken(_ value: String) -> Bool {
    value.count >= 48 && value.count <= 256 &&
        value.range(of: #"^obenr_[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil
}

public struct MacOSNodeConfiguration: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.macos-node-config/v1"

    public let format: String
    public let nodeId: String
    public let serverUrl: String
    public let maxConcurrentRuns: Int
    public let logLevel: String

    public init(
        format: String = Self.formatValue,
        nodeId: String,
        serverUrl: String,
        maxConcurrentRuns: Int = 1,
        logLevel: String = "info"
    ) throws {
        self.format = format
        self.nodeId = nodeId
        self.serverUrl = serverUrl
        self.maxConcurrentRuns = maxConcurrentRuns
        self.logLevel = logLevel
        try validate()
    }

    public static func decodeStrict(_ data: Data) throws -> Self {
        try requireJSONObjectKeys(
            data,
            expected: ["format", "nodeId", "serverUrl", "maxConcurrentRuns", "logLevel"],
            error: .invalidConfiguration
        )
        do {
            let value = try JSONDecoder().decode(Self.self, from: data)
            try value.validate()
            return value
        } catch {
            throw OpenBotMacOSError.invalidConfiguration
        }
    }

    public func encoded() throws -> Data {
        try validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    public func validate() throws {
        guard format == Self.formatValue,
              isValidNodeId(nodeId),
              maxConcurrentRuns >= 1,
              maxConcurrentRuns <= 16,
              ["debug", "info", "warn", "error"].contains(logLevel),
              try isValidServerURL(serverUrl)
        else {
            throw OpenBotMacOSError.invalidConfiguration
        }
    }
}

public struct NodeIdentity: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.node-identity/v1"

    public let format: String
    public let nodeId: String
    public let credential: String
    public let enrolledAt: String

    public init(format: String = Self.formatValue, nodeId: String, credential: String, enrolledAt: String) throws {
        self.format = format
        self.nodeId = nodeId
        self.credential = credential
        self.enrolledAt = enrolledAt
        try validate()
    }

    public static func decodeStrict(_ data: Data) throws -> Self {
        try requireJSONObjectKeys(
            data,
            expected: ["format", "nodeId", "credential", "enrolledAt"],
            error: .invalidIdentity
        )
        do {
            let value = try JSONDecoder().decode(Self.self, from: data)
            try value.validate()
            return value
        } catch {
            throw OpenBotMacOSError.invalidIdentity
        }
    }

    public func encoded() throws -> Data {
        try validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    public func validate() throws {
        guard format == Self.formatValue,
              isValidNodeId(nodeId),
              credential.count >= 47,
              credential.count <= 256,
              credential.range(of: #"^obn_[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil,
              isValidISO8601Date(enrolledAt)
        else {
            throw OpenBotMacOSError.invalidIdentity
        }
    }
}

private func isValidISO8601Date(_ source: String) -> Bool {
    guard source.count >= 20, source.count <= 40 else { return false }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if formatter.date(from: source) != nil { return true }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: source) != nil
}

public struct MacOSKeychainEnvelope: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.macos-keychain-node/v1"
    public static let maximumBytes = 4 * 1024

    public let format: String
    public let serverUrl: String
    public let identity: NodeIdentity

    public init(format: String = Self.formatValue, serverUrl: String, identity: NodeIdentity) throws {
        self.format = format
        self.serverUrl = serverUrl
        self.identity = identity
        try validate()
    }

    public static func decodeStrict(_ data: Data) throws -> Self {
        guard data.count >= 1, data.count <= maximumBytes else {
            throw OpenBotMacOSError.invalidIdentity
        }
        try requireJSONObjectKeys(
            data,
            expected: ["format", "serverUrl", "identity"],
            error: .invalidIdentity
        )
        do {
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            guard let identityObject = object?["identity"],
                  JSONSerialization.isValidJSONObject(identityObject)
            else {
                throw OpenBotMacOSError.invalidIdentity
            }
            let identityData = try JSONSerialization.data(withJSONObject: identityObject)
            _ = try NodeIdentity.decodeStrict(identityData)
            let value = try JSONDecoder().decode(Self.self, from: data)
            try value.validate()
            return value
        } catch {
            throw OpenBotMacOSError.invalidIdentity
        }
    }

    public func encoded() throws -> Data {
        try validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(self)
        guard data.count <= Self.maximumBytes else { throw OpenBotMacOSError.invalidIdentity }
        return data
    }

    public func validate() throws {
        guard format == Self.formatValue, try isValidServerURL(serverUrl) else {
            throw OpenBotMacOSError.invalidIdentity
        }
        try identity.validate()
    }

    public func requireMatches(_ configuration: MacOSNodeConfiguration) throws {
        guard identity.nodeId == configuration.nodeId, serverUrl == configuration.serverUrl else {
            throw OpenBotMacOSError.invalidIdentity
        }
    }
}

public func enrollmentEndpoint(for serverUrl: String) throws -> URL {
    guard try isValidServerURL(serverUrl), var components = URLComponents(string: serverUrl) else {
        throw OpenBotMacOSError.invalidConfiguration
    }
    components.scheme = components.scheme == "wss" ? "https" : "http"
    components.path = "/api/v1/nodes/enroll"
    components.query = nil
    components.fragment = nil
    guard let result = components.url else { throw OpenBotMacOSError.invalidConfiguration }
    return result
}

private func requireJSONObjectKeys(_ data: Data, expected: Set<String>, error: OpenBotMacOSError) throws {
    do {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == expected
        else {
            throw error
        }
    } catch {
        throw error
    }
}

private func isValidNodeId(_ value: String) -> Bool {
    value.count >= 1 && value.count <= 128 &&
        value.range(of: #"^[A-Za-z0-9][A-Za-z0-9._:-]*$"#, options: .regularExpression) != nil
}

private func isValidServerURL(_ source: String) throws -> Bool {
    guard source.count <= 2_048,
          let components = URLComponents(string: source),
          let scheme = components.scheme,
          let host = components.host,
          !host.isEmpty,
          components.user == nil,
          components.password == nil,
          components.fragment == nil,
          scheme == "ws" || scheme == "wss",
          components.url?.absoluteString == source
    else {
        return false
    }
    if scheme == "ws" && !["localhost", "127.0.0.1", "::1"].contains(host.lowercased()) {
        return false
    }
    return true
}
