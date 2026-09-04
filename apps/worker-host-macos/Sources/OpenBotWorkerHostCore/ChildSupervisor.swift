import Darwin
import Dispatch
import Foundation
import OpenBotWorkerHostPOSIX

public final class SpawnedNodeProcess: @unchecked Sendable {
    public let pid: pid_t
    private var inputDescriptor: Int32
    private let lock = NSLock()

    public init(policy: NodeChildLaunchPolicy) throws {
        var childPID: pid_t = 0
        var descriptor: Int32 = -1
        let arguments = [policy.executable] + policy.arguments
        let environment = policy.environment.keys.sorted().map { "\($0)=\(policy.environment[$0]!)" }
        let result = try withCStringArray(arguments) { argv in
            try withCStringArray(environment) { envp in
                policy.executable.withCString { executable in
                    policy.workingDirectory.withCString { directory in
                        openbot_spawn_child(
                            executable,
                            argv,
                            envp,
                            directory,
                            &childPID,
                            &descriptor
                        )
                    }
                }
            }
        }
        guard result == 0, childPID > 1, descriptor >= 0 else {
            throw OpenBotMacOSError.childFailure
        }
        pid = childPID
        inputDescriptor = descriptor
    }

    deinit { closeInput() }

    public func start(identity: NodeIdentity) throws {
        let data = try identity.encoded()
        guard data.count >= 1, data.count <= MacOSKeychainEnvelope.maximumBytes else {
            throw OpenBotMacOSError.invalidIdentity
        }
        var frame = Data("OPENBOT_NODE_CONTROL/3 IDENTITY \(data.count)\n".utf8)
        frame.append(data)
        frame.append(Data("OPENBOT_NODE_CONTROL/3 START\n".utf8))
        try write(frame)
    }

    public func requestShutdown() throws {
        try write(Data("OPENBOT_NODE_CONTROL/3 SHUTDOWN\n".utf8))
        closeInput()
    }

    public func wait(noHang: Bool = true) throws -> Int32? {
        var status: Int32 = 0
        let result = openbot_wait_child(pid, &status, noHang ? 1 : 0)
        if result == 0 { return nil }
        guard result == 1 else { throw OpenBotMacOSError.childFailure }
        return status
    }

    public func signalGroup(_ signalNumber: Int32) throws {
        guard openbot_signal_child_group(pid, signalNumber) == 0 else {
            throw OpenBotMacOSError.childFailure
        }
    }

    public func groupExists() throws -> Bool {
        let result = openbot_child_group_exists(pid)
        guard result >= 0 else { throw OpenBotMacOSError.childFailure }
        return result == 1
    }

    public func closeInput() {
        lock.lock()
        defer { lock.unlock() }
        if inputDescriptor >= 0 {
            Darwin.close(inputDescriptor)
            inputDescriptor = -1
        }
    }

    private func write(_ data: Data) throws {
        lock.lock()
        defer { lock.unlock() }
        guard inputDescriptor >= 0 else { throw OpenBotMacOSError.childFailure }
        let result = data.withUnsafeBytes { buffer in
            openbot_write_all(
                inputDescriptor,
                buffer.bindMemory(to: UInt8.self).baseAddress,
                buffer.count
            )
        }
        guard result == 0 else { throw OpenBotMacOSError.childFailure }
    }
}

public struct NodeProcessSupervisor: Sendable {
    private let pollNanoseconds: UInt64

    public init(pollNanoseconds: UInt64 = 50_000_000) {
        self.pollNanoseconds = pollNanoseconds
    }

    public func run(process: SpawnedNodeProcess, identity: NodeIdentity) throws -> Int32 {
        Darwin.signal(SIGTERM, SIG_IGN)
        Darwin.signal(SIGINT, SIG_IGN)
        let shutdown = DispatchSemaphore(value: 0)
        let signalQueue = DispatchQueue(label: "com.openbot.worker-host.signals")
        let termSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: signalQueue)
        let interruptSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: signalQueue)
        termSource.setEventHandler { shutdown.signal() }
        interruptSource.setEventHandler { shutdown.signal() }
        termSource.resume()
        interruptSource.resume()
        defer {
            termSource.cancel()
            interruptSource.cancel()
        }

        try process.start(identity: identity)
        while true {
            if shutdown.wait(timeout: .now()) == .success {
                return try stop(process: process)
            }
            if try process.wait() != nil {
                process.closeInput()
                try cleanUnexpectedDescendants(process)
                return 1
            }
            Thread.sleep(forTimeInterval: Double(pollNanoseconds) / 1_000_000_000)
        }
    }

    private func stop(process: SpawnedNodeProcess) throws -> Int32 {
        try? process.requestShutdown()
        if try waitForExit(process, seconds: 20) { return 0 }
        try process.signalGroup(SIGTERM)
        if try waitForExit(process, seconds: 4) { return 0 }
        try process.signalGroup(SIGKILL)
        guard try waitForExit(process, seconds: 1) else {
            throw OpenBotMacOSError.childFailure
        }
        return 0
    }

    private func cleanUnexpectedDescendants(_ process: SpawnedNodeProcess) throws {
        guard try process.groupExists() else { return }
        try process.signalGroup(SIGTERM)
        let deadline = Date().addingTimeInterval(1)
        while Date() < deadline, try process.groupExists() {
            Thread.sleep(forTimeInterval: 0.05)
        }
        if try process.groupExists() { try process.signalGroup(SIGKILL) }
    }

    private func waitForExit(_ process: SpawnedNodeProcess, seconds: TimeInterval) throws -> Bool {
        let deadline = Date().addingTimeInterval(seconds)
        var reaped = false
        while Date() < deadline {
            if !reaped, try process.wait() != nil { reaped = true }
            if reaped, try !process.groupExists() { return true }
            Thread.sleep(forTimeInterval: 0.05)
        }
        return false
    }
}

private func withCStringArray<Result>(
    _ strings: [String],
    _ body: (UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>) throws -> Result
) throws -> Result {
    let copies = strings.map { strdup($0) }
    guard copies.allSatisfy({ $0 != nil }) else {
        for copy in copies { free(copy) }
        throw OpenBotMacOSError.childFailure
    }
    var pointers = copies + [nil]
    defer { for copy in copies { free(copy) } }
    return try pointers.withUnsafeMutableBufferPointer { buffer in
        try body(buffer.baseAddress!)
    }
}
