/* OpenBot MIT. See docs/research/desktop-postgres-parent-lifecycle.md. */
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

extern char **environ;
static volatile sig_atomic_t stopping = 0;

static void request_stop(int signal_number) {
  (void)signal_number;
  stopping = 1;
}

static long long milliseconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return -1;
  return (long long)now.tv_sec * 1000 + now.tv_nsec / 1000000;
}

/* The caller owns the pipe writer; PostgreSQL never inherits its reader. */
static int parent_stopped(int timeout) {
  struct pollfd input = {.fd = STDIN_FILENO, .events = POLLIN};
  int result = poll(&input, 1, timeout);
  if (result < 0) return errno == EINTR ? stopping : 1;
  return stopping || (result > 0 && input.revents != 0);
}

int main(int argc, char **argv) {
  struct stat input;
  if (argc != 4 || argv[1][0] != '/' || argv[2][0] != '/' ||
      fstat(STDIN_FILENO, &input) != 0 ||
      !(S_ISFIFO(input.st_mode) || S_ISSOCK(input.st_mode))) return 64;
  const char *name = strrchr(argv[1], '/');
  if (name == NULL || strcmp(name + 1, "postgres") != 0) return 64;
  char *end = NULL;
  errno = 0;
  long port = strtol(argv[3], &end, 10);
  if (errno != 0 || end == argv[3] || *end != '\0' || port < 1 || port > 65535) return 64;

  struct sigaction action = {0};
  sigemptyset(&action.sa_mask);
  /* Keep children waitable even if the launching environment ignored SIGCHLD. */
  action.sa_handler = SIG_DFL;
  if (sigaction(SIGCHLD, &action, NULL) != 0) return 70;
  action.sa_handler = request_stop;
  if (sigaction(SIGINT, &action, NULL) != 0 ||
      sigaction(SIGTERM, &action, NULL) != 0 ||
      sigaction(SIGHUP, &action, NULL) != 0 ||
      sigaction(SIGQUIT, &action, NULL) != 0) return 70;
  if (parent_stopped(0)) return 0;

  posix_spawn_file_actions_t files;
  posix_spawnattr_t attributes;
  if (posix_spawn_file_actions_init(&files) != 0) return 70;
  if (posix_spawnattr_init(&attributes) != 0) {
    posix_spawn_file_actions_destroy(&files);
    return 70;
  }
  sigset_t defaults, mask;
  sigemptyset(&defaults);
  sigemptyset(&mask);
  const int signals[] = {SIGINT, SIGTERM, SIGHUP, SIGQUIT, SIGPIPE, SIGCHLD};
  for (unsigned int i = 0; i < sizeof(signals) / sizeof(signals[0]); ++i)
    sigaddset(&defaults, signals[i]);
  int error = posix_spawn_file_actions_addopen(&files, STDIN_FILENO, "/dev/null", O_RDONLY, 0);
  if (error == 0) error = posix_spawnattr_setsigdefault(&attributes, &defaults);
  if (error == 0) error = posix_spawnattr_setsigmask(&attributes, &mask);
  if (error == 0)
    error = posix_spawnattr_setflags(&attributes, POSIX_SPAWN_SETSIGDEF | POSIX_SPAWN_SETSIGMASK);
  char *arguments[] = {argv[1], "-D", argv[2], "-h", "127.0.0.1", "-p", argv[3], "-k", "", NULL};
  pid_t child = -1;
  if (error == 0) error = posix_spawn(&child, argv[1], &files, &attributes, arguments, environ);
  posix_spawn_file_actions_destroy(&files);
  posix_spawnattr_destroy(&attributes);
  if (error != 0) return 70;

  long long stop_started = -1;
  int stage = 0;
  for (;;) {
    int status = 0;
    pid_t waited = waitpid(child, &status, WNOHANG);
    if (waited == child) {
      if (WIFEXITED(status)) return WEXITSTATUS(status);
      return WIFSIGNALED(status) ? 128 + WTERMSIG(status) : 70;
    }
    if (waited < 0 && errno != EINTR) return 70;
    if (waited < 0) continue;
    if (!stopping && parent_stopped(200)) stopping = 1;
    long long now = milliseconds();
    if (now < 0) stopping = 1;
    /* Only this process reaps this child. An unreaped PID cannot be reused here. */
    if (stopping && stage == 0) {
      kill(child, SIGINT);
      stop_started = now;
      stage = 1;
    }
    if (stage == 1 && (now < 0 || now - stop_started >= 8000)) {
      kill(child, SIGQUIT);
      stage = 2;
    }
    if (stage == 2 && (now < 0 || now - stop_started >= 12000)) {
      kill(child, SIGKILL);
      stage = 3;
    }
    if (stopping) {
      struct timespec pause = {.tv_sec = 0, .tv_nsec = 50000000};
      nanosleep(&pause, NULL);
    }
  }
}
