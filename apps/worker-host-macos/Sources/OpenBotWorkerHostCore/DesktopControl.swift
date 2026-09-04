import Foundation

public enum DesktopWorkerHostState: String, Codable, Equatable, Sendable {
    case notConfigured = "not-configured"
    case disabled
    case requiresApproval = "requires-approval"
    case enabled
    case invalid
}

public enum DesktopWorkerHostControlAction: String, Codable, Sendable {
    case status
    case enroll
    case enable
    case openSettings = "open-settings"
}

public struct DesktopWorkerHostControlRequest: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.macos-desktop-control/v1"
    public static let maximumBytes = 8 * 1024

    public let action: DesktopWorkerHostControlAction
    public let enrollmentToken: String?
    public let format: String
    public let nodeId: String?
    public let serverUrl: String?

    public static func status() -> Self {
        Self(action: .status, enrollmentToken: nil, nodeId: nil, serverUrl: nil)
    }

    public static func enable() -> Self {
        Self(action: .enable, enrollmentToken: nil, nodeId: nil, serverUrl: nil)
    }

    public static func openSettings() -> Self {
        Self(action: .openSettings, enrollmentToken: nil, nodeId: nil, serverUrl: nil)
    }

    public static func enroll(nodeId: String, serverUrl: String, enrollmentToken: String) throws -> Self {
        let value = Self(
            action: .enroll,
            enrollmentToken: enrollmentToken,
            nodeId: nodeId,
            serverUrl: serverUrl
        )
        try value.validate()
        return value
    }

    public static func decodeStrict(_ data: Data) throws -> Self {
        guard data.count >= 1, data.count <= maximumBytes else {
            throw OpenBotMacOSError.invalidControlRequest
        }
        do {
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let action = object["action"] as? String
            else {
                throw OpenBotMacOSError.invalidControlRequest
            }
            let expectedKeys: Set<String> = action == DesktopWorkerHostControlAction.enroll.rawValue
                ? ["action", "enrollmentToken", "format", "nodeId", "serverUrl"]
                : ["action", "format"]
            guard Set(object.keys) == expectedKeys else {
                throw OpenBotMacOSError.invalidControlRequest
            }
            let value = try JSONDecoder().decode(Self.self, from: data)
            try value.validate()
            guard try value.encoded() == data else {
                throw OpenBotMacOSError.invalidControlRequest
            }
            return value
        } catch {
            throw OpenBotMacOSError.invalidControlRequest
        }
    }

    public static func decodeFrame(_ data: Data) throws -> Self {
        guard data.count >= 2,
              data.count <= maximumBytes + 1,
              data.last == 0x0A,
              !data.dropLast().contains(0x0A)
        else {
            throw OpenBotMacOSError.invalidControlRequest
        }
        return try decodeStrict(data.dropLast())
    }

    public func encoded() throws -> Data {
        try validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(self)
        guard data.count <= Self.maximumBytes else {
            throw OpenBotMacOSError.invalidControlRequest
        }
        return data
    }

    private init(
        action: DesktopWorkerHostControlAction,
        enrollmentToken: String?,
        nodeId: String?,
        serverUrl: String?
    ) {
        self.action = action
        self.enrollmentToken = enrollmentToken
        format = Self.formatValue
        self.nodeId = nodeId
        self.serverUrl = serverUrl
    }

    private func validate() throws {
        guard format == Self.formatValue else {
            throw OpenBotMacOSError.invalidControlRequest
        }
        switch action {
        case .status, .enable, .openSettings:
            guard enrollmentToken == nil, nodeId == nil, serverUrl == nil else {
                throw OpenBotMacOSError.invalidControlRequest
            }
        case .enroll:
            guard let nodeId, let serverUrl, let enrollmentToken,
                  isValidEnrollmentToken(enrollmentToken)
            else {
                throw OpenBotMacOSError.invalidControlRequest
            }
            _ = try MacOSNodeConfiguration(nodeId: nodeId, serverUrl: serverUrl)
        }
    }
}

public struct DesktopWorkerHostControlResponse: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.macos-desktop-control-result/v1"

    public let format: String
    public let status: DesktopWorkerHostState

    public init(status: DesktopWorkerHostState) {
        format = Self.formatValue
        self.status = status
    }

    public func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    public func encodedFrame() throws -> Data {
        var data = try encoded()
        data.append(0x0A)
        return data
    }
}

public struct DesktopWorkerHostController: Sendable {
    private let configurationStore: any MacOSConfigurationStoring
    private let enrollmentClient: any NodeEnrollmentClient
    private let identityStore: any NodeIdentityStore
    private let registration: any WorkerHostRegistrationManaging

    public init(
        configurationStore: any MacOSConfigurationStoring,
        enrollmentClient: any NodeEnrollmentClient,
        identityStore: any NodeIdentityStore,
        registration: any WorkerHostRegistrationManaging
    ) {
        self.configurationStore = configurationStore
        self.enrollmentClient = enrollmentClient
        self.identityStore = identityStore
        self.registration = registration
    }

    public func handle(_ request: DesktopWorkerHostControlRequest) async -> DesktopWorkerHostControlResponse {
        do {
            let state = switch request.action {
            case .status:
                try readState()
            case .enroll:
                try await enroll(request)
            case .enable:
                try enable()
            case .openSettings:
                try openSettings()
            }
            return DesktopWorkerHostControlResponse(status: state)
        } catch {
            return DesktopWorkerHostControlResponse(status: .invalid)
        }
    }

    private func readState() throws -> DesktopWorkerHostState {
        let configuration: MacOSNodeConfiguration
        do {
            configuration = try configurationStore.load()
        } catch OpenBotMacOSError.unavailableConfiguration {
            return .notConfigured
        }
        guard let envelope = try identityStore.load(configuration: configuration) else {
            return .invalid
        }
        try envelope.requireMatches(configuration)
        return project(registration.status())
    }

    private func enroll(_ request: DesktopWorkerHostControlRequest) async throws -> DesktopWorkerHostState {
        guard let nodeId = request.nodeId,
              let serverUrl = request.serverUrl,
              let enrollmentToken = request.enrollmentToken
        else {
            throw OpenBotMacOSError.invalidControlRequest
        }
        let configuration = try MacOSNodeConfiguration(nodeId: nodeId, serverUrl: serverUrl)
        let identity = try await enrollmentClient.exchange(
            nodeId: nodeId,
            serverUrl: serverUrl,
            token: enrollmentToken
        )
        let envelope = try MacOSKeychainEnvelope(serverUrl: serverUrl, identity: identity)
        try identityStore.save(envelope, configuration: configuration)
        guard try identityStore.load(configuration: configuration) == envelope else {
            throw OpenBotMacOSError.keychainFailure
        }
        try configurationStore.save(configuration)
        guard try configurationStore.load() == configuration else {
            throw OpenBotMacOSError.invalidConfiguration
        }
        try registration.register()
        return project(registration.status())
    }

    private func enable() throws -> DesktopWorkerHostState {
        let current = try readState()
        guard current == .disabled else { return current }
        try registration.register()
        return project(registration.status())
    }

    private func openSettings() throws -> DesktopWorkerHostState {
        let current = try readState()
        guard current == .requiresApproval else { return current }
        registration.openSystemSettingsLoginItems()
        return project(registration.status())
    }

    private func project(_ status: WorkerHostRegistrationStatus) -> DesktopWorkerHostState {
        switch status {
        case .notRegistered: .disabled
        case .enabled: .enabled
        case .requiresApproval: .requiresApproval
        case .notFound: .invalid
        }
    }
}
