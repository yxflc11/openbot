using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace OpenBot.WorkerHost.Windows;

internal sealed class WindowsWorkerService : BackgroundService
{
    private readonly NodeProcessSupervisor supervisor;
    private readonly ILogger<WindowsWorkerService> logger;

    public WindowsWorkerService(
        NodeProcessSupervisor supervisor,
        ILogger<WindowsWorkerService> logger)
    {
        this.supervisor = supervisor;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await supervisor.StartAsync(stoppingToken);
            logger.LogInformation("OpenBot Node entered its assigned Windows Job.");
            var exitCode = await supervisor.WaitForExitAsync();
            if (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError("OpenBot Node exited outside a requested service stop with code {ExitCode}.", exitCode);
                throw new InvalidOperationException("OpenBot Node exited unexpectedly.");
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // StopAsync owns the bounded cooperative drain and forced Job termination.
        }
        catch
        {
            logger.LogError("OpenBot Node service lifecycle failed.");
            throw;
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            await supervisor.StopAsync(cancellationToken);
            logger.LogInformation("OpenBot Node and its Windows Job stopped.");
        }
        catch
        {
            logger.LogError("OpenBot Node service stop failed.");
            throw;
        }
        finally
        {
            await base.StopAsync(cancellationToken);
        }
    }
}
