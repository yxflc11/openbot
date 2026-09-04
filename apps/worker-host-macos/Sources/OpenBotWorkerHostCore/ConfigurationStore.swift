import Darwin
import Foundation

public struct MacOSConfigurationStore: Sendable {
    public static let maximumBytes = 16 * 1024

    public let configurationURL: URL
    public let workDirectoryURL: URL
    private let expectedUserID: uid_t

    public init(homeDirectory: URL, expectedUserID: uid_t = getuid()) throws {
        guard homeDirectory.isFileURL,
              homeDirectory.path.hasPrefix("/"),
              homeDirectory.path != "/",
              homeDirectory.standardizedFileURL.path == homeDirectory.path,
              expectedUserID > 0
        else {
            throw OpenBotMacOSError.invalidConfiguration
        }
        let root = homeDirectory
            .appendingPathComponent("Library/Application Support/OpenBot/Node", isDirectory: true)
        configurationURL = root.appendingPathComponent("config.json", isDirectory: false)
        workDirectoryURL = root.appendingPathComponent("work", isDirectory: true)
        self.expectedUserID = expectedUserID
    }

    public func load() throws -> MacOSNodeConfiguration {
        let descriptor = Darwin.open(configurationURL.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard descriptor >= 0 else { throw OpenBotMacOSError.unavailableConfiguration }
        defer { Darwin.close(descriptor) }

        var before = stat()
        guard fstat(descriptor, &before) == 0 else {
            throw OpenBotMacOSError.unavailableConfiguration
        }
        try validate(metadata: before)

        var bytes = [UInt8](repeating: 0, count: Self.maximumBytes + 1)
        let capacity = bytes.count
        var offset = 0
        while offset < capacity {
            let amount = bytes.withUnsafeMutableBytes { buffer in
                Darwin.read(descriptor, buffer.baseAddress!.advanced(by: offset), capacity - offset)
            }
            if amount < 0 && errno == EINTR { continue }
            guard amount >= 0 else { throw OpenBotMacOSError.unavailableConfiguration }
            if amount == 0 { break }
            offset += amount
        }
        defer {
            _ = bytes.withUnsafeMutableBytes {
                $0.initializeMemory(as: UInt8.self, repeating: 0)
            }
        }
        guard offset >= 1, offset <= Self.maximumBytes else {
            throw OpenBotMacOSError.invalidConfiguration
        }

        var after = stat()
        guard fstat(descriptor, &after) == 0 else {
            throw OpenBotMacOSError.unavailableConfiguration
        }
        try validate(metadata: after)
        guard before.st_dev == after.st_dev,
              before.st_ino == after.st_ino,
              before.st_size == after.st_size,
              before.st_mtimespec.tv_sec == after.st_mtimespec.tv_sec,
              before.st_mtimespec.tv_nsec == after.st_mtimespec.tv_nsec,
              before.st_ctimespec.tv_sec == after.st_ctimespec.tv_sec,
              before.st_ctimespec.tv_nsec == after.st_ctimespec.tv_nsec
        else {
            throw OpenBotMacOSError.invalidConfiguration
        }
        return try MacOSNodeConfiguration.decodeStrict(Data(bytes[0..<offset]))
    }

    public func save(_ configuration: MacOSNodeConfiguration) throws {
        let data = try configuration.encoded()
        guard data.count <= Self.maximumBytes else { throw OpenBotMacOSError.invalidConfiguration }
        let parent = configurationURL.deletingLastPathComponent()
        try createPrivateDirectories(through: parent)
        try createPrivateDirectories(through: workDirectoryURL)
        try validateExistingConfigurationIfPresent()

        var template = Array(
            parent.appendingPathComponent(".config.json.XXXXXX").path.utf8CString
        )
        let descriptor = template.withUnsafeMutableBufferPointer { mkstemp($0.baseAddress!) }
        guard descriptor >= 0 else { throw OpenBotMacOSError.unavailableConfiguration }
        let temporaryPath = String(
            decoding: template.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) },
            as: UTF8.self
        )
        var keepTemporary = true
        defer {
            Darwin.close(descriptor)
            if keepTemporary { unlink(temporaryPath) }
        }
        guard fchmod(descriptor, mode_t(0o600)) == 0 else {
            throw OpenBotMacOSError.unavailableConfiguration
        }
        try data.withUnsafeBytes { buffer in
            var offset = 0
            while offset < buffer.count {
                let amount = Darwin.write(
                    descriptor,
                    buffer.baseAddress!.advanced(by: offset),
                    buffer.count - offset
                )
                if amount < 0 && errno == EINTR { continue }
                guard amount > 0 else { throw OpenBotMacOSError.unavailableConfiguration }
                offset += amount
            }
        }
        guard fsync(descriptor) == 0,
              rename(temporaryPath, configurationURL.path) == 0
        else {
            throw OpenBotMacOSError.unavailableConfiguration
        }
        keepTemporary = false
        _ = try load()
    }

    public func ensureWorkDirectory() throws {
        try createPrivateDirectories(through: workDirectoryURL)
    }

    public func remove() throws {
        do {
            _ = try load()
        } catch OpenBotMacOSError.unavailableConfiguration {
            return
        }
        guard unlink(configurationURL.path) == 0 || errno == ENOENT else {
            throw OpenBotMacOSError.unavailableConfiguration
        }
    }

    private func validate(metadata: stat) throws {
        guard (metadata.st_mode & S_IFMT) == S_IFREG,
              metadata.st_uid == expectedUserID,
              metadata.st_nlink == 1,
              (metadata.st_mode & 0o777) == 0o600,
              metadata.st_size >= 1,
              metadata.st_size <= Self.maximumBytes
        else {
            throw OpenBotMacOSError.invalidConfiguration
        }
    }

    private func validateExistingConfigurationIfPresent() throws {
        var metadata = stat()
        if lstat(configurationURL.path, &metadata) != 0 {
            if errno == ENOENT { return }
            throw OpenBotMacOSError.unavailableConfiguration
        }
        try validate(metadata: metadata)
    }

    private func createPrivateDirectories(through target: URL) throws {
        try FileManager.default.createDirectory(
            at: target,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        var metadata = stat()
        guard lstat(target.path, &metadata) == 0,
              (metadata.st_mode & S_IFMT) == S_IFDIR,
              metadata.st_uid == expectedUserID,
              (metadata.st_mode & 0o077) == 0
        else {
            throw OpenBotMacOSError.invalidConfiguration
        }
    }
}
