import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type CommandResult = Readonly<{
  stdout: string;
  stderr: string;
}>;

export type RunningCommand = Readonly<{
  child: ChildProcessWithoutNullStreams;
  output: () => string;
  waitForOutput: (pattern: RegExp, timeout: number) => Promise<RegExpMatchArray>;
  stop: () => Promise<void>;
}>;

type CommandOptions = Readonly<{
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}>;

type RunCommandOptions = CommandOptions &
  Readonly<{
    timeout?: number;
  }>;

function commandError(command: string, args: readonly string[], output: string): Error {
  return new Error(`command failed: ${[command, ...args].join(" ")}\n${output}`);
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeout: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      child.off("exit", handleExit);
      resolve(false);
    }, timeout);
    const handleExit = () => {
      clearTimeout(timeoutId);
      resolve(true);
    };
    child.once("exit", handleExit);
  });
}

function processGroupExists(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

async function waitForProcessGroupExit(pid: number, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (processGroupExists(pid)) {
    if (Date.now() >= deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      throw error;
    }
  }
}

function taskkill(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const killer = spawn("taskkill.exe", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("error", reject);
    killer.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`taskkill failed for process ${pid} with exit code ${code}`));
    });
  });
}

async function stopWindowsProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (child.pid === undefined) {
    throw new Error("cannot stop a child process without a process ID");
  }
  await taskkill(child.pid);
  if (!(await waitForExit(child, 5_000))) {
    throw new Error(`failed to stop child process ${child.pid}`);
  }
}

async function stopPosixProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.pid === undefined || !processGroupExists(child.pid)) {
    return;
  }
  signalProcessGroup(child.pid, "SIGINT");
  if (await waitForProcessGroupExit(child.pid, 5_000)) {
    return;
  }
  signalProcessGroup(child.pid, "SIGTERM");
  if (await waitForProcessGroupExit(child.pid, 5_000)) {
    return;
  }
  signalProcessGroup(child.pid, "SIGKILL");
  if (!(await waitForProcessGroupExit(child.pid, 5_000))) {
    throw new Error(`failed to stop child process ${child.pid}`);
  }
}

function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  return process.platform === "win32" ? stopWindowsProcessTree(child) : stopPosixProcessTree(child);
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      detached: process.platform !== "win32",
      env: options.env,
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    let termination: string | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let settled = false;
    const dispose = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      options.signal?.removeEventListener("abort", handleAbort);
    };
    const rejectTerminationFailure = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      dispose();
      reject(
        new AggregateError(
          [error],
          commandError(command, args, `${stdout}${stderr}\n${termination}`).message,
        ),
      );
    };
    const terminate = (reason: string) => {
      if (termination !== undefined) {
        return;
      }
      termination = reason;
      void stopChild(child).catch(rejectTerminationFailure);
    };
    const handleAbort = () => {
      terminate(`aborted: ${String(options.signal?.reason)}`);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      dispose();
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      dispose();
      if (termination !== undefined) {
        reject(commandError(command, args, `${stdout}${stderr}\n${termination}`));
        return;
      }
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        commandError(command, args, `${stdout}${stderr}\nexit code: ${code}, signal: ${signal}`),
      );
    });
    if (options.timeout !== undefined) {
      timeoutId = setTimeout(
        () => terminate(`timed out after ${options.timeout}ms`),
        options.timeout,
      );
    }
    options.signal?.addEventListener("abort", handleAbort, { once: true });
    if (options.signal?.aborted) {
      handleAbort();
    }
  });
}

export function startCommand(
  command: string,
  args: readonly string[],
  options: CommandOptions,
): RunningCommand {
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: process.platform !== "win32",
    env: options.env,
    stdio: "pipe",
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    output += chunk;
  });
  let stopError: unknown;
  let stopPromise: Promise<void> | undefined;
  const stop = async () => {
    stopPromise ??= stopChild(child).catch((error: unknown) => {
      stopError = error;
    });
    await stopPromise;
    if (stopError !== undefined) {
      throw stopError;
    }
  };
  const handleAbort = () => {
    void stop().catch((error: unknown) => {
      stopError = error;
    });
  };
  let closeResult: Readonly<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
  child.once("close", (code, signal) => {
    closeResult = { code, signal };
    options.signal?.removeEventListener("abort", handleAbort);
  });
  options.signal?.addEventListener("abort", handleAbort, { once: true });
  if (options.signal?.aborted) {
    handleAbort();
  }

  return {
    child,
    output: () => output,
    waitForOutput: (pattern, timeout) =>
      new Promise((resolve, reject) => {
        const findMatch = () => {
          const match = output.match(pattern);
          if (!match) {
            return false;
          }
          dispose();
          resolve(match);
          return true;
        };
        const handleData = () => {
          findMatch();
        };
        const handleError = (error: Error) => {
          dispose();
          reject(error);
        };
        const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
          dispose();
          reject(
            commandError(
              command,
              args,
              `${output}\nexited before expected output: ${code}, signal: ${signal}`,
            ),
          );
        };
        const timeoutId = setTimeout(() => {
          dispose();
          reject(commandError(command, args, `${output}\ntimed out waiting for ${pattern}`));
        }, timeout);
        const dispose = () => {
          clearTimeout(timeoutId);
          child.stdout.off("data", handleData);
          child.stderr.off("data", handleData);
          child.off("error", handleError);
          child.off("close", handleExit);
        };
        child.stdout.on("data", handleData);
        child.stderr.on("data", handleData);
        child.once("error", handleError);
        child.once("close", handleExit);
        if (!findMatch() && closeResult !== undefined) {
          handleExit(closeResult.code, closeResult.signal);
        }
      }),
    stop,
  };
}
