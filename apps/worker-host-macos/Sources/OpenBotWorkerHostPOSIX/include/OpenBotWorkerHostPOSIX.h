#ifndef OPENBOT_WORKER_HOST_POSIX_H
#define OPENBOT_WORKER_HOST_POSIX_H

#include <stddef.h>
#include <sys/types.h>

int openbot_spawn_child(
    const char *executable,
    char *const argv[],
    char *const envp[],
    const char *working_directory,
    pid_t *pid_out,
    int *input_fd_out
);

int openbot_wait_child(pid_t pid, int *status_out, int no_hang);
int openbot_signal_child_group(pid_t pid, int signal_number);
int openbot_child_group_exists(pid_t pid);
int openbot_write_all(int fd, const unsigned char *bytes, size_t count);

#endif
