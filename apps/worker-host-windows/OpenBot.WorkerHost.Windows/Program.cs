using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace OpenBot.WorkerHost.Windows;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("OpenBot Windows Worker Host requires Windows.");
            return 1;
        }

        var builder = Host.CreateApplicationBuilder(args);
        builder.Services.AddWindowsService(options => options.ServiceName = "OpenBot Node");
        builder.Services.Configure<HostOptions>(options =>
        {
            options.ShutdownTimeout = TimeSpan.FromSeconds(25);
            options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.StopHost;
        });
        builder.Services.AddSingleton(
            NodeLaunchPlan.Create(
                AppContext.BaseDirectory,
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                Environment.GetEnvironmentVariables()));
        builder.Services.AddSingleton<INodeProcessLauncher, WindowsJobNodeProcessLauncher>();
        builder.Services.AddSingleton<NodeProcessSupervisor>();
        builder.Services.AddHostedService<WindowsWorkerService>();

        await builder.Build().RunAsync();
        return 0;
    }
}
