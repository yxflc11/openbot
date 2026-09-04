using System.Diagnostics;
using Meziantou.Framework.Win32;

namespace OpenBot.WorkerHost.Windows;

public sealed class WindowsJobNodeProcessLauncher : INodeProcessLauncher
{
    public IManagedNodeProcess Start(NodeLaunchPlan plan)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("Windows Job Objects require Windows.");
        }

        if (!File.Exists(plan.ExecutablePath) || !File.Exists(plan.EntryPointPath))
        {
            throw new InvalidOperationException("The verified Node release is incomplete.");
        }

        var job = new JobObject();
        Process? process = null;
        try
        {
            job.SetLimits(new JobObjectLimits { Flags = JobObjectLimitFlags.KillOnJobClose });
            var startInfo = new ProcessStartInfo
            {
                FileName = plan.ExecutablePath,
                WorkingDirectory = plan.WorkingDirectory,
                UseShellExecute = false,
                RedirectStandardInput = true,
                CreateNoWindow = true,
            };
            startInfo.ArgumentList.Add(plan.EntryPointPath);
            startInfo.Environment.Clear();
            foreach (var (name, value) in plan.Environment)
            {
                startInfo.Environment[name] = value;
            }

            process = Process.Start(startInfo)
                ?? throw new InvalidOperationException("The Node process did not start.");
            job.AssignProcess(process);
            if (!job.IsAssignedToProcess(process))
            {
                throw new InvalidOperationException("The Node process is outside its Job Object.");
            }

            return new WindowsJobNodeProcess(process, job);
        }
        catch
        {
            if (process is not null)
            {
                TryTerminateInertProcess(process);
            }

            job.Dispose();
            process?.Dispose();
            throw;
        }
    }

    private static void TryTerminateInertProcess(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill();
                process.WaitForExit(5_000);
            }
        }
        catch
        {
            // The caller still fails start. The Node entry point has not received START, so it has
            // not constructed a client or Provider; native evidence must still exercise this path.
        }
    }

    private sealed class WindowsJobNodeProcess : IManagedNodeProcess
    {
        private readonly Process process;
        private readonly JobObject job;

        public WindowsJobNodeProcess(Process process, JobObject job)
        {
            this.process = process;
            this.job = job;
            ExitCode = ObserveExitCodeAsync(process);
        }

        public Task<int> ExitCode { get; }

        public async ValueTask WriteControlAsync(
            ReadOnlyMemory<byte> frame,
            CancellationToken cancellationToken)
        {
            await process.StandardInput.BaseStream.WriteAsync(frame, cancellationToken);
            await process.StandardInput.BaseStream.FlushAsync(cancellationToken);
        }

        public void Terminate() => job.Terminate(1);

        public async Task WaitForEmptyJobAsync(TimeSpan timeout)
        {
            using var deadline = new CancellationTokenSource(timeout);
            while (job.GetBasicAccountingInformation().ActiveProcesses != 0)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(50), deadline.Token);
            }
        }

        public ValueTask DisposeAsync()
        {
            try
            {
                process.StandardInput.Dispose();
                process.Dispose();
            }
            finally
            {
                // KillOnJobClose is the last-resort parent-crash and disposal boundary.
                job.Dispose();
            }

            return ValueTask.CompletedTask;
        }

        private static async Task<int> ObserveExitCodeAsync(Process process)
        {
            await process.WaitForExitAsync();
            return process.ExitCode;
        }
    }
}
