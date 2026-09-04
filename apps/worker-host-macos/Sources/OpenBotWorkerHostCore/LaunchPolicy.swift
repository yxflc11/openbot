import Foundation

public struct NodeChildLaunchPolicy: Equatable, Sendable {
    public let executable: String
    public let arguments: [String]
    public let environment: [String: String]
    public let workingDirectory: String

    public init(
        applicationRoot: URL,
        homeDirectory: URL,
        workDirectory: URL
    ) throws {
        guard applicationRoot.isFileURL,
              applicationRoot.path == applicationRoot.standardizedFileURL.path,
              applicationRoot.lastPathComponent == "OpenBot Worker Host.app",
              homeDirectory.isFileURL,
              workDirectory.isFileURL,
              workDirectory.path.hasPrefix(homeDirectory.path + "/")
        else {
            throw OpenBotMacOSError.invalidBundle
        }
        executable = applicationRoot
            .appendingPathComponent("Contents/Resources/node/bin/node").path
        let entry = applicationRoot
            .appendingPathComponent("Contents/Resources/node/app/index.js").path
        arguments = ["--jitless", entry]
        environment = ["HOME": homeDirectory.path]
        workingDirectory = workDirectory.path
    }
}
