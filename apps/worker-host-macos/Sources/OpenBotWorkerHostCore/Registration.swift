import Foundation
import ServiceManagement

public enum WorkerHostRegistrationStatus: String, CaseIterable, Sendable {
    case notRegistered
    case enabled
    case requiresApproval
    case notFound
}

public protocol WorkerHostRegistrationManaging: Sendable {
    func status() -> WorkerHostRegistrationStatus
    func register() throws
    func openSystemSettingsLoginItems()
}

@available(macOS 13.0, *)
public struct SystemWorkerHostRegistration: WorkerHostRegistrationManaging, Sendable {
    public static let propertyListName = "com.openbot.worker-host.node.plist"

    public init() {}

    public func status() -> WorkerHostRegistrationStatus {
        Self.map(SMAppService.agent(plistName: Self.propertyListName).status)
    }

    public func register() throws {
        do {
            try SMAppService.agent(plistName: Self.propertyListName).register()
        } catch {
            throw OpenBotMacOSError.registrationFailure
        }
    }

    public func unregister() throws {
        do {
            try SMAppService.agent(plistName: Self.propertyListName).unregister()
        } catch {
            throw OpenBotMacOSError.registrationFailure
        }
    }

    public func openSystemSettingsLoginItems() {
        SMAppService.openSystemSettingsLoginItems()
    }

    public static func map(_ status: SMAppService.Status) -> WorkerHostRegistrationStatus {
        switch status {
        case .notRegistered: .notRegistered
        case .enabled: .enabled
        case .requiresApproval: .requiresApproval
        case .notFound: .notFound
        @unknown default: .notFound
        }
    }
}
