using System.Collections;
using System.Collections.ObjectModel;

namespace OpenBot.WorkerHost.Windows;

public sealed record NodeLaunchPlan(
    string ExecutablePath,
    string EntryPointPath,
    string WorkingDirectory,
    IReadOnlyDictionary<string, string> Environment)
{
    private static readonly string[] ForwardedVariables =
    [
        "OPENBOT_NODE_ID",
        "OPENBOT_NODE_SERVER_URL",
        "OPENBOT_NODE_ENROLLMENT_TOKEN",
        "OPENBOT_NODE_CREDENTIAL",
        "OPENBOT_NODE_CREDENTIAL_STORE",
        "OPENBOT_NODE_CREDENTIAL_PATH",
        "OPENBOT_NODE_MAX_CONCURRENT_RUNS",
        "OPENBOT_LOG_LEVEL",
        "OPENBOT_DOCKER_COMPUTER_URL",
        "OPENBOT_DOCKER_COMPUTER_TOKEN",
        "OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
    ];

    public static NodeLaunchPlan Create(
        string releaseDirectory,
        string commonApplicationData,
        IDictionary sourceEnvironment)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(releaseDirectory);
        ArgumentException.ThrowIfNullOrWhiteSpace(commonApplicationData);
        ArgumentNullException.ThrowIfNull(sourceEnvironment);

        var releaseRoot = Path.GetFullPath(releaseDirectory);
        var stateRoot = Path.GetFullPath(Path.Combine(commonApplicationData, "OpenBot", "node"));
        var environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in ForwardedVariables)
        {
            if (sourceEnvironment[name] is string value && value.Length > 0)
            {
                environment[name] = value;
            }
        }

        // These values define the private lifecycle and fixed writable-state boundaries. A service
        // registry entry cannot replace them with another protocol or working directory.
        environment["OPENBOT_NODE_SERVICE_CONTROL"] = "stdio-v2";
        environment["OPENBOT_NODE_WORK_DIRECTORY"] = stateRoot;

        return new NodeLaunchPlan(
            Path.Combine(releaseRoot, "bin", "node.exe"),
            Path.Combine(releaseRoot, "app", "index.js"),
            releaseRoot,
            new ReadOnlyDictionary<string, string>(environment));
    }
}
