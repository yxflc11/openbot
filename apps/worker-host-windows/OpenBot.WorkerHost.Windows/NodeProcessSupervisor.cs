using System.Text;

namespace OpenBot.WorkerHost.Windows;

public interface IManagedNodeProcess : IAsyncDisposable
{
    Task<int> ExitCode { get; }

    ValueTask WriteControlAsync(ReadOnlyMemory<byte> frame, CancellationToken cancellationToken);

    void Terminate();

    Task WaitForEmptyJobAsync(TimeSpan timeout);
}

public interface INodeProcessLauncher
{
    IManagedNodeProcess Start(NodeLaunchPlan plan);
}

public sealed class NodeProcessSupervisor
{
    public static ReadOnlyMemory<byte> StartFrame { get; } =
        Encoding.ASCII.GetBytes("OPENBOT_NODE_CONTROL/2 START\n");

    public static ReadOnlyMemory<byte> ShutdownFrame { get; } =
        Encoding.ASCII.GetBytes("OPENBOT_NODE_CONTROL/2 SHUTDOWN\n");

    private static readonly TimeSpan DefaultGracePeriod = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan ForcedExitTimeout = TimeSpan.FromSeconds(5);
    private readonly object sync = new();
    private readonly INodeProcessLauncher launcher;
    private readonly NodeLaunchPlan plan;
    private readonly TimeSpan gracePeriod;
    private Task? startTask;
    private Task? stopTask;
    private IManagedNodeProcess? process;
    private bool stopping;

    public NodeProcessSupervisor(INodeProcessLauncher launcher, NodeLaunchPlan plan)
        : this(launcher, plan, DefaultGracePeriod)
    {
    }

    public NodeProcessSupervisor(
        INodeProcessLauncher launcher,
        NodeLaunchPlan plan,
        TimeSpan gracePeriod)
    {
        ArgumentNullException.ThrowIfNull(launcher);
        ArgumentNullException.ThrowIfNull(plan);
        if (gracePeriod < TimeSpan.Zero || gracePeriod > DefaultGracePeriod)
        {
            throw new ArgumentOutOfRangeException(nameof(gracePeriod));
        }

        this.launcher = launcher;
        this.plan = plan;
        this.gracePeriod = gracePeriod;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        lock (sync)
        {
            if (stopping)
            {
                throw new InvalidOperationException("The Node process is already stopping.");
            }

            startTask ??= StartOnceAsync(cancellationToken);
            return startTask;
        }
    }

    public async Task<int> WaitForExitAsync()
    {
        Task pendingStart;
        lock (sync)
        {
            pendingStart = startTask ?? throw new InvalidOperationException("The Node process has not started.");
        }

        await pendingStart;
        IManagedNodeProcess running;
        lock (sync)
        {
            running = process ?? throw new InvalidOperationException("The Node process is unavailable.");
        }

        return await running.ExitCode;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        lock (sync)
        {
            stopping = true;
            stopTask ??= StopOnceAsync(cancellationToken);
            return stopTask;
        }
    }

    private async Task StartOnceAsync(CancellationToken cancellationToken)
    {
        IManagedNodeProcess? launched = null;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            launched = launcher.Start(plan);
            lock (sync)
            {
                process = launched;
            }

            // The launcher returns only after it assigns the inert Node process to the Job. Sending
            // START is therefore the first point at which the Node may create its client.
            await launched.WriteControlAsync(StartFrame, cancellationToken);
        }
        catch
        {
            if (launched is not null)
            {
                await TerminateAndDisposeAsync(launched);
                lock (sync)
                {
                    if (ReferenceEquals(process, launched))
                    {
                        process = null;
                    }
                }
            }

            throw;
        }
    }

    private async Task StopOnceAsync(CancellationToken cancellationToken)
    {
        Task? pendingStart;
        lock (sync)
        {
            pendingStart = startTask;
        }

        if (pendingStart is null)
        {
            return;
        }

        try
        {
            await pendingStart;
        }
        catch
        {
            return;
        }

        IManagedNodeProcess? running;
        lock (sync)
        {
            running = process;
        }

        if (running is null)
        {
            return;
        }

        Exception? failure = null;
        try
        {
            await running.WriteControlAsync(ShutdownFrame, cancellationToken);
            var deadline = Task.Delay(gracePeriod, cancellationToken);
            if (await Task.WhenAny(running.ExitCode, deadline) != running.ExitCode)
            {
                running.Terminate();
            }

            var exitCode = await running.ExitCode.WaitAsync(ForcedExitTimeout);
            if (exitCode != 0)
            {
                throw new InvalidOperationException("The Node process reported a failed shutdown.");
            }
            await running.WaitForEmptyJobAsync(ForcedExitTimeout);
        }
        catch (Exception error)
        {
            failure = error;
            try
            {
                running.Terminate();
                await running.ExitCode.WaitAsync(ForcedExitTimeout);
                await running.WaitForEmptyJobAsync(ForcedExitTimeout);
            }
            catch (Exception terminationError)
            {
                failure = new AggregateException(error, terminationError);
            }
        }
        finally
        {
            await running.DisposeAsync();
            lock (sync)
            {
                if (ReferenceEquals(process, running))
                {
                    process = null;
                }
            }
        }

        if (failure is not null)
        {
            throw new InvalidOperationException("The Node process did not stop cleanly.", failure);
        }
    }

    private static async Task TerminateAndDisposeAsync(IManagedNodeProcess launched)
    {
        try
        {
            launched.Terminate();
            await launched.ExitCode.WaitAsync(ForcedExitTimeout);
            await launched.WaitForEmptyJobAsync(ForcedExitTimeout);
        }
        finally
        {
            await launched.DisposeAsync();
        }
    }
}
