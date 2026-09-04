// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "OpenBotWorkerHostMacOS",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "OpenBotWorkerHostCore", targets: ["OpenBotWorkerHostCore"]),
        .executable(name: "OpenBotWorkerHostControl", targets: ["OpenBotWorkerHostControl"]),
    ],
    targets: [
        .target(
            name: "OpenBotWorkerHostPOSIX",
            publicHeadersPath: "include"
        ),
        .target(
            name: "OpenBotWorkerHostCore",
            dependencies: ["OpenBotWorkerHostPOSIX"]
        ),
        .executableTarget(
            name: "OpenBotWorkerHostControl",
            dependencies: ["OpenBotWorkerHostCore"]
        ),
        .testTarget(
            name: "OpenBotWorkerHostCoreTests",
            dependencies: ["OpenBotWorkerHostCore"]
        ),
    ]
)
