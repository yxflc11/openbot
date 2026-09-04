#include "OpenBotWorkerHostPOSIX.h"

#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int openbot_spawn_child(
    const char *executable,
    char *const argv[],
    char *const envp[],
    const char *working_directory,
    pid_t *pid_out,
    int *input_fd_out
) {
    if (executable == NULL || argv == NULL || envp == NULL || working_directory == NULL ||
        pid_out == NULL || input_fd_out == NULL) {
        return EINVAL;
    }

    int input_pipe[2];
    if (pipe(input_pipe) != 0) {
        return errno;
    }
    if (fcntl(input_pipe[0], F_SETFD, FD_CLOEXEC) != 0 ||
        fcntl(input_pipe[1], F_SETFD, FD_CLOEXEC) != 0) {
        int result = errno;
        close(input_pipe[0]);
        close(input_pipe[1]);
        return result;
    }

    posix_spawn_file_actions_t actions;
    posix_spawnattr_t attributes;
    int result = posix_spawn_file_actions_init(&actions);
    if (result != 0) {
        close(input_pipe[0]);
        close(input_pipe[1]);
        return result;
    }
    result = posix_spawnattr_init(&attributes);
    if (result != 0) {
        posix_spawn_file_actions_destroy(&actions);
        close(input_pipe[0]);
        close(input_pipe[1]);
        return result;
    }

    result = posix_spawn_file_actions_adddup2(&actions, input_pipe[0], STDIN_FILENO);
    if (result == 0) result = posix_spawn_file_actions_addclose(&actions, input_pipe[0]);
    if (result == 0) result = posix_spawn_file_actions_addclose(&actions, input_pipe[1]);
    if (result == 0) result = posix_spawn_file_actions_addchdir_np(&actions, working_directory);

    short flags = POSIX_SPAWN_SETPGROUP;
#ifdef POSIX_SPAWN_CLOEXEC_DEFAULT
    flags |= POSIX_SPAWN_CLOEXEC_DEFAULT;
#endif
    if (result == 0) result = posix_spawnattr_setflags(&attributes, flags);
    if (result == 0) result = posix_spawnattr_setpgroup(&attributes, 0);

    pid_t child = 0;
    if (result == 0) {
        result = posix_spawn(&child, executable, &actions, &attributes, argv, envp);
    }

    posix_spawnattr_destroy(&attributes);
    posix_spawn_file_actions_destroy(&actions);
    close(input_pipe[0]);

    if (result != 0) {
        close(input_pipe[1]);
        return result;
    }

    *pid_out = child;
    *input_fd_out = input_pipe[1];
    return 0;
}

int openbot_wait_child(pid_t pid, int *status_out, int no_hang) {
    if (pid <= 1 || status_out == NULL) return -EINVAL;
    int status = 0;
    pid_t result;
    do {
        result = waitpid(pid, &status, no_hang ? WNOHANG : 0);
    } while (result < 0 && errno == EINTR);
    if (result < 0) return -errno;
    if (result == 0) return 0;
    *status_out = status;
    return 1;
}

int openbot_signal_child_group(pid_t pid, int signal_number) {
    if (pid <= 1 || signal_number <= 0) return EINVAL;
    if (kill(-pid, signal_number) == 0 || errno == ESRCH) return 0;
    return errno;
}

int openbot_child_group_exists(pid_t pid) {
    if (pid <= 1) return -EINVAL;
    if (kill(-pid, 0) == 0 || errno == EPERM) return 1;
    if (errno == ESRCH) return 0;
    return -errno;
}

int openbot_write_all(int fd, const unsigned char *bytes, size_t count) {
    if (fd < 0 || (bytes == NULL && count != 0)) return EINVAL;
    size_t offset = 0;
    while (offset < count) {
        ssize_t written = write(fd, bytes + offset, count - offset);
        if (written < 0 && errno == EINTR) continue;
        if (written <= 0) return written == 0 ? EIO : errno;
        offset += (size_t)written;
    }
    return 0;
}
