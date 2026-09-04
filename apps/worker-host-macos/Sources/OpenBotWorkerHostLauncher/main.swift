import Darwin
import Foundation
import OpenBotWorkerHostCore

func runWorkerHost() throws -> Int32 {
    guard CommandLine.arguments.count == 1, getuid() > 0 else {
        throw OpenBotMacOSError.invalidConfiguration
    }
    let launcherURL = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
    let application = try InstalledWorkerHostApplication(launcherURL: launcherURL)
    try application.validate()

    let homeDirectory = try currentUserHomeDirectory()
    let configurationStore = try MacOSConfigurationStore(homeDirectory: homeDirectory)
    let configuration = try configurationStore.load()
    try configurationStore.ensureWorkDirectory()

    let accessGroup = try MacOSAccessGroup.current()
    let identityStore = try SystemNodeIdentityStore(accessGroup: accessGroup)
    guard let envelope = try identityStore.load(configuration: configuration) else {
        throw OpenBotMacOSError.unavailableIdentity
    }
    try envelope.requireMatches(configuration)

    let policy = try NodeChildLaunchPolicy(
        applicationRoot: application.root,
        homeDirectory: homeDirectory,
        workDirectory: configurationStore.workDirectoryURL
    )
    let child = try SpawnedNodeProcess(policy: policy)
    return try NodeProcessSupervisor().run(process: child, identity: envelope.identity)
}

do {
    exit(try runWorkerHost())
} catch {
    fputs("OpenBot Worker Host failed.\n", stderr)
    exit(1)
}
