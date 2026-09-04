import CryptoKit
import Darwin
import Foundation

public struct WorkerHostRuntimeManifest: Codable, Equatable, Sendable {
    public static let formatValue = "openbot.macos-worker-host-manifest/v1"
    public static let manifestRelativePath = "Contents/Resources/manifest.json"
    public static let requiredPaths = [
        "Contents/Resources/node/app/index.js",
        "Contents/Resources/node/bin/node",
    ]

    public struct FileRecord: Codable, Equatable, Sendable {
        public let path: String
        public let sha256: String
        public let size: Int
        public let mode: String

        public init(path: String, sha256: String, size: Int, mode: String) {
            self.path = path
            self.sha256 = sha256
            self.size = size
            self.mode = mode
        }
    }

    public let format: String
    public let version: String
    public let sourceCommit: String
    public let architecture: String
    public let files: [FileRecord]

    public static func loadAndValidate(
        applicationRoot: URL,
        expectedOwner: uid_t = 0
    ) throws -> Self {
        let manifestURL = applicationRoot.appendingPathComponent(manifestRelativePath)
        let data = try readTrustedFile(
            manifestURL,
            expectedOwner: expectedOwner,
            maximumBytes: 8 * 1024,
            requiredMode: 0o644
        )
        try requireManifestShape(data)
        let manifest: Self
        do {
            manifest = try JSONDecoder().decode(Self.self, from: data)
        } catch {
            throw OpenBotMacOSError.invalidBundle
        }
        try manifest.validate(applicationRoot: applicationRoot, expectedOwner: expectedOwner)
        return manifest
    }

    public func validate(applicationRoot: URL, expectedOwner: uid_t = 0) throws {
        guard format == Self.formatValue,
              version.range(of: #"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$"#, options: .regularExpression) != nil,
              sourceCommit.range(of: #"^[a-f0-9]{40}$"#, options: .regularExpression) != nil,
              ["arm64", "x64"].contains(architecture),
              files.map(\.path) == Self.requiredPaths
        else {
            throw OpenBotMacOSError.invalidBundle
        }
        for record in files {
            let maximum = record.path.hasSuffix("/node") ? 128 * 1024 * 1024 : 16 * 1024 * 1024
            guard record.size >= 1,
                  record.size <= maximum,
                  record.sha256.range(of: #"^[a-f0-9]{64}$"#, options: .regularExpression) != nil,
                  record.mode == (record.path.hasSuffix("/node") ? "0755" : "0644")
            else {
                throw OpenBotMacOSError.invalidBundle
            }
            let fileURL = applicationRoot.appendingPathComponent(record.path)
            let data = try readTrustedFile(
                fileURL,
                expectedOwner: expectedOwner,
                maximumBytes: maximum,
                requiredMode: record.path.hasSuffix("/node") ? 0o755 : 0o644
            )
            guard data.count == record.size,
                  SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == record.sha256
            else {
                throw OpenBotMacOSError.invalidBundle
            }
        }
    }
}

private func requireManifestShape(_ data: Data) throws {
    do {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(root.keys) == ["format", "version", "sourceCommit", "architecture", "files"],
              let files = root["files"] as? [[String: Any]],
              files.count == WorkerHostRuntimeManifest.requiredPaths.count,
              files.allSatisfy({ Set($0.keys) == ["path", "sha256", "size", "mode"] })
        else {
            throw OpenBotMacOSError.invalidBundle
        }
    } catch {
        throw OpenBotMacOSError.invalidBundle
    }
}

private func readTrustedFile(
    _ url: URL,
    expectedOwner: uid_t,
    maximumBytes: Int,
    requiredMode: mode_t
) throws -> Data {
    let descriptor = Darwin.open(url.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
    guard descriptor >= 0 else { throw OpenBotMacOSError.invalidBundle }
    defer { Darwin.close(descriptor) }
    var metadata = stat()
    guard fstat(descriptor, &metadata) == 0,
          (metadata.st_mode & S_IFMT) == S_IFREG,
          metadata.st_uid == expectedOwner,
          metadata.st_nlink == 1,
          (metadata.st_mode & 0o777) == requiredMode,
          metadata.st_size >= 1,
          metadata.st_size <= maximumBytes
    else {
        throw OpenBotMacOSError.invalidBundle
    }
    var result = Data()
    result.reserveCapacity(Int(metadata.st_size))
    var buffer = [UInt8](repeating: 0, count: min(64 * 1024, maximumBytes + 1))
    var total = 0
    while true {
        let amount = buffer.withUnsafeMutableBytes { raw in
            Darwin.read(descriptor, raw.baseAddress, raw.count)
        }
        if amount < 0 && errno == EINTR { continue }
        guard amount >= 0 else { throw OpenBotMacOSError.invalidBundle }
        if amount == 0 { break }
        total += amount
        guard total <= maximumBytes else { throw OpenBotMacOSError.invalidBundle }
        result.append(buffer, count: amount)
    }
    return result
}
