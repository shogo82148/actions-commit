import { spawn } from "node:child_process";

/**
 * Runs a git command and returns its standard output.
 *
 * @param args The arguments passed to git.
 * @param cwd The working directory.
 * @returns The standard output of the command.
 */
export async function git(args: string[], cwd: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      const message = Buffer.concat(stderr).toString("utf8").trim();
      reject(
        new Error(
          `git ${args.join(" ")} failed with exit code ${code}: ${message}`,
        ),
      );
    });
  });
}

/** File modes of git objects. */
export const FileMode = {
  Regular: "100644",
  Executable: "100755",
  Symlink: "120000",
  Submodule: "160000",
  Missing: "000000",
} as const;

/** A change of a staged file. */
export interface StagedChange {
  /** The path of the file, relative to the repository root. */
  path: string;
  /** The status of the change, e.g. "A", "M", "D", "T". */
  status: string;
  /** The file mode before the change. */
  oldMode: string;
  /** The file mode after the change. */
  newMode: string;
  /** The blob SHA after the change. */
  newSha: string;
}

/**
 * Parses the output of `git diff --raw -z --no-renames`.
 *
 * @param output The output of the command.
 * @returns The list of the changes.
 */
export function parseRawDiff(output: string): StagedChange[] {
  const tokens = output.split("\0");
  const changes: StagedChange[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const meta = tokens[i];
    const path = tokens[i + 1];
    // e.g. ":100644 100644 <old sha> <new sha> M"
    const m = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/.exec(
      meta,
    );
    if (!m) {
      throw new Error(`unexpected output of git diff: ${JSON.stringify(meta)}`);
    }
    changes.push({
      path,
      oldMode: m[1],
      newMode: m[2],
      newSha: m[4],
      status: m[5],
    });
  }
  return changes;
}

/**
 * Stages all changes under the working directory.
 *
 * @param cwd The working directory.
 */
export async function stageAll(cwd: string): Promise<void> {
  await git(["add", "--all", "--", "."], cwd);
}

/**
 * Unstages all changes.
 *
 * @param cwd The working directory.
 */
export async function unstageAll(cwd: string): Promise<void> {
  await git(["reset", "--quiet", "HEAD"], cwd);
}

/**
 * Lists the staged changes.
 *
 * @param cwd The working directory.
 * @returns The list of the staged changes.
 */
export async function getStagedChanges(cwd: string): Promise<StagedChange[]> {
  const output = await git(
    ["diff", "--cached", "--raw", "-z", "--no-renames", "--no-abbrev"],
    cwd,
  );
  return parseRawDiff(output.toString("utf8"));
}

/**
 * Reads the contents of a blob.
 *
 * @param sha The SHA of the blob.
 * @param cwd The working directory.
 * @returns The contents of the blob.
 */
export async function readBlob(sha: string, cwd: string): Promise<Buffer> {
  return git(["cat-file", "blob", sha], cwd);
}

/**
 * Resolves the commit SHA of HEAD.
 *
 * @param cwd The working directory.
 * @returns The SHA of HEAD.
 */
export async function getHeadSha(cwd: string): Promise<string> {
  const output = await git(["rev-parse", "HEAD"], cwd);
  return output.toString("utf8").trim();
}
