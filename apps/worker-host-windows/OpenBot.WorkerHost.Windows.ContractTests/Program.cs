using System.Collections;
using OpenBot.WorkerHost.Windows;

namespace OpenBot.WorkerHost.Windows.ContractTests;

internal static class Program
{
  private static readonly (string Name, Func<Task> Run)[] Tests =
  [
    ("launch plan fixes executable, entry, state, and environment", LaunchPlanIsFixed),
    ("start frame follows Job assignment", StartFrameFollowsAssignment),
    ("start write failure terminates and disposes", StartFailureTerminates),
    ("graceful stop drains and disposes without termination", GracefulStopDrains),
    ("deadline terminates the complete Job", DeadlineTerminates),
    ("stop before start is inert and blocks later start", StopBeforeStartIsInert),
  ];

  public static async Task<int> Main()
  {
    foreach (var (name, run) in Tests)
    {
      try
      {
        await run();
        Console.WriteLine($"PASS {name}");
      }
      catch (Exception error)
      {
        Console.Error.WriteLine($"FAIL {name}: {error.Message}");
        return 1;
      }
    }

    Console.WriteLine($"Windows Worker Host contract tests passed: {Tests.Length}.");
    return 0;
  }

  private static Task LaunchPlanIsFixed()
  {
    var environment = new Hashtable(StringComparer.OrdinalIgnoreCase)
    {
      ["OPENBOT_NODE_ID"] = "node-1",
      ["OPENBOT_NODE_SERVICE_CONTROL"] = "attacker-mode",
      ["OPENBOT_NODE_WORK_DIRECTORY"] = "C:\\attacker",
      ["NODE_OPTIONS"] = "--require C:\\attacker.js",
      ["SystemRoot"] = "C:\\Windows",
    };
    var releaseRoot = Path.Combine(Path.GetTempPath(), "OpenBot", "current");
    var commonApplicationData = Path.Combine(Path.GetTempPath(), "ProgramData");
    var plan = NodeLaunchPlan.Create(releaseRoot, commonApplicationData, environment);

    Equal(Path.GetFullPath(Path.Combine(releaseRoot, "bin", "node.exe")), plan.ExecutablePath);
    Equal(Path.GetFullPath(Path.Combine(releaseRoot, "app", "index.js")), plan.EntryPointPath);
    Equal("stdio-v2", plan.Environment["OPENBOT_NODE_SERVICE_CONTROL"]);
    Equal(
        Path.GetFullPath(Path.Combine(commonApplicationData, "OpenBot", "node")),
        plan.Environment["OPENBOT_NODE_WORK_DIRECTORY"]);
    Equal("node-1", plan.Environment["OPENBOT_NODE_ID"]);
    False(plan.Environment.ContainsKey("NODE_OPTIONS"), "NODE_OPTIONS must not reach the child.");
    return Task.CompletedTask;
  }

  private static async Task StartFrameFollowsAssignment()
  {
    var process = new FakeProcess();
    var launcher = new FakeLauncher(process);
    var supervisor = CreateSupervisor(launcher, TimeSpan.FromSeconds(1));

    await supervisor.StartAsync(CancellationToken.None);

    Equal("assigned", launcher.Events[0]);
    Equal("OPENBOT_NODE_CONTROL/2 START\n", process.Frames.Single());
    Equal("start-frame", launcher.Events[1]);
    process.Complete(0);
    Equal(0, await supervisor.WaitForExitAsync());
  }

  private static async Task StartFailureTerminates()
  {
    var process = new FakeProcess { FailWrites = true };
    var supervisor = CreateSupervisor(new FakeLauncher(process), TimeSpan.FromSeconds(1));

    await ThrowsAsync<IOException>(() => supervisor.StartAsync(CancellationToken.None));

    True(process.Terminated, "Failed start must terminate the Job.");
    True(process.Disposed, "Failed start must dispose the Job.");
  }

  private static async Task GracefulStopDrains()
  {
    var process = new FakeProcess { CompleteOnShutdown = true };
    var supervisor = CreateSupervisor(new FakeLauncher(process), TimeSpan.FromSeconds(1));

    await supervisor.StartAsync(CancellationToken.None);
    var first = supervisor.StopAsync(CancellationToken.None);
    var second = supervisor.StopAsync(CancellationToken.None);
    True(ReferenceEquals(first, second), "Repeated stop must return the same task.");
    await first;

    Equal(
        new[] { "OPENBOT_NODE_CONTROL/2 START\n", "OPENBOT_NODE_CONTROL/2 SHUTDOWN\n" },
        process.Frames);
    False(process.Terminated, "Graceful exit must not force termination.");
    True(process.JobEmptyWaited, "Stop must prove the Job is empty.");
    True(process.Disposed, "Stop must dispose the Job.");
  }

  private static async Task DeadlineTerminates()
  {
    var process = new FakeProcess();
    var supervisor = CreateSupervisor(new FakeLauncher(process), TimeSpan.Zero);

    await supervisor.StartAsync(CancellationToken.None);
    await ThrowsAsync<InvalidOperationException>(() => supervisor.StopAsync(CancellationToken.None));

    True(process.Terminated, "An expired grace period must terminate the Job.");
    True(process.JobEmptyWaited, "Forced stop must prove the Job is empty.");
    True(process.Disposed, "Forced stop must dispose the Job.");
  }

  private static async Task StopBeforeStartIsInert()
  {
    var launcher = new FakeLauncher(new FakeProcess());
    var supervisor = CreateSupervisor(launcher, TimeSpan.Zero);

    await supervisor.StopAsync(CancellationToken.None);
    Equal(0, launcher.Events.Count);
    await ThrowsAsync<InvalidOperationException>(() => supervisor.StartAsync(CancellationToken.None));
  }

  private static NodeProcessSupervisor CreateSupervisor(FakeLauncher launcher, TimeSpan gracePeriod)
  {
    var plan = NodeLaunchPlan.Create(
        Path.Combine(Path.GetTempPath(), "OpenBot"),
        Path.Combine(Path.GetTempPath(), "ProgramData"),
        new Hashtable());
    return new NodeProcessSupervisor(launcher, plan, gracePeriod);
  }

  private static void Equal<T>(T expected, T actual)
  {
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
      throw new InvalidOperationException($"Expected '{expected}', received '{actual}'.");
    }
  }

  private static void Equal<T>(IEnumerable<T> expected, IEnumerable<T> actual)
  {
    if (!expected.SequenceEqual(actual))
    {
      throw new InvalidOperationException("Sequences differ.");
    }
  }

  private static void True(bool value, string message)
  {
    if (!value)
    {
      throw new InvalidOperationException(message);
    }
  }

  private static void False(bool value, string message) => True(!value, message);

  private static async Task ThrowsAsync<TException>(Func<Task> action)
      where TException : Exception
  {
    try
    {
      await action();
    }
    catch (TException)
    {
      return;
    }

    throw new InvalidOperationException($"Expected {typeof(TException).Name}.");
  }

  private sealed class FakeLauncher : INodeProcessLauncher
  {
    private readonly FakeProcess process;

    public FakeLauncher(FakeProcess process)
    {
      this.process = process;
      process.OnFrame = frame => Events.Add(frame.Contains("START", StringComparison.Ordinal) ? "start-frame" : "shutdown-frame");
    }

    public List<string> Events { get; } = [];

    public IManagedNodeProcess Start(NodeLaunchPlan plan)
    {
      Events.Add("assigned");
      return process;
    }
  }

  private sealed class FakeProcess : IManagedNodeProcess
  {
    private readonly TaskCompletionSource<int> exit = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Action<string>? OnFrame { get; set; }

    public List<string> Frames { get; } = [];

    public bool CompleteOnShutdown { get; set; }

    public bool FailWrites { get; set; }

    public bool Terminated { get; private set; }

    public bool JobEmptyWaited { get; private set; }

    public bool Disposed { get; private set; }

    public Task<int> ExitCode => exit.Task;

    public ValueTask WriteControlAsync(ReadOnlyMemory<byte> frame, CancellationToken cancellationToken)
    {
      cancellationToken.ThrowIfCancellationRequested();
      if (FailWrites)
      {
        throw new IOException("simulated control failure");
      }

      var value = System.Text.Encoding.ASCII.GetString(frame.Span);
      Frames.Add(value);
      OnFrame?.Invoke(value);
      if (CompleteOnShutdown && value.Contains("SHUTDOWN", StringComparison.Ordinal))
      {
        Complete(0);
      }

      return ValueTask.CompletedTask;
    }

    public void Terminate()
    {
      Terminated = true;
      Complete(1);
    }

    public Task WaitForEmptyJobAsync(TimeSpan timeout)
    {
      JobEmptyWaited = true;
      return Task.CompletedTask;
    }

    public ValueTask DisposeAsync()
    {
      Disposed = true;
      return ValueTask.CompletedTask;
    }

    public void Complete(int exitCode) => exit.TrySetResult(exitCode);
  }
}
