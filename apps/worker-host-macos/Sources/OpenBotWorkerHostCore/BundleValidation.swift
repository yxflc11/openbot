import Darwin
import Foundation
import Security

public struct InstalledWorkerHostApplication: Sendable {
    public static let fixedRoot = URL(fileURLWithPath: "/Applications/OpenBot Worker Host.app")
    public static let launcherRelativePath = "Contents/Resources/OpenBotWorkerHostLauncher"

    public let root: URL
    public let nodeExecutable: URL
    public let nodeEntry: URL

    public init(launcherURL: URL) throws {
        let resolvedLauncher = launcherURL.resolvingSymlinksInPath().standardizedFileURL
        let expectedLauncher = Self.fixedRoot
            .appendingPathComponent(Self.launcherRelativePath)
            .standardizedFileURL
        guard resolvedLauncher.path == expectedLauncher.path else {
            throw OpenBotMacOSError.invalidBundle
        }
        root = Self.fixedRoot
        nodeExecutable = root.appendingPathComponent("Contents/Resources/node/bin/node")
        nodeEntry = root.appendingPathComponent("Contents/Resources/node/app/index.js")
    }

    public func validate() throws {
        try validateRegularFile(nodeExecutable, executable: true)
        try validateRegularFile(nodeEntry, executable: false)
        try validateCode(at: root)
        try validateCurrentCode()
    }

    private func validateRegularFile(_ url: URL, executable: Bool) throws {
        var metadata = stat()
        guard lstat(url.path, &metadata) == 0,
              (metadata.st_mode & S_IFMT) == S_IFREG,
              metadata.st_uid == 0,
              metadata.st_nlink == 1,
              (metadata.st_mode & 0o022) == 0,
              (!executable || (metadata.st_mode & 0o111) != 0),
              (executable || (metadata.st_mode & 0o111) == 0),
              metadata.st_size >= 1
        else {
            throw OpenBotMacOSError.invalidBundle
        }
    }

    private func validateCode(at url: URL) throws {
        var code: SecStaticCode?
        guard SecStaticCodeCreateWithPath(url as CFURL, [], &code) == errSecSuccess,
              let code,
              SecStaticCodeCheckValidity(
                  code,
                  SecCSFlags(rawValue: (1 << 0) | (1 << 3) | (1 << 4)),
                  nil
              ) == errSecSuccess
        else {
            throw OpenBotMacOSError.invalidBundle
        }
    }

    private func validateCurrentCode() throws {
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess,
              let code,
              SecCodeCheckValidity(code, SecCSFlags(rawValue: 1 << 4), nil) == errSecSuccess
        else {
            throw OpenBotMacOSError.invalidBundle
        }
    }
}

public func currentUserHomeDirectory() throws -> URL {
    let userID = getuid()
    guard userID > 0 else { throw OpenBotMacOSError.invalidConfiguration }
    let suggested = max(1_024, Int(sysconf(_SC_GETPW_R_SIZE_MAX)))
    var buffer = [CChar](repeating: 0, count: min(suggested, 64 * 1024))
    var record = passwd()
    var result: UnsafeMutablePointer<passwd>?
    let status = getpwuid_r(userID, &record, &buffer, buffer.count, &result)
    guard status == 0, result != nil, let directory = record.pw_dir else {
        throw OpenBotMacOSError.invalidConfiguration
    }
    let path = String(cString: directory)
    guard path.hasPrefix("/"), path != "/", path.utf8.count <= 1_024 else {
        throw OpenBotMacOSError.invalidConfiguration
    }
    return URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
}
