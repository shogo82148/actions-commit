import * as core from "@actions/core";
import * as path from "node:path";
import {
  FileMode,
  getHeadSha,
  getStagedChanges,
  readBlob,
  stageAll,
  unstageAll,
} from "./git.js";
import { Commit, FileAddition, FileDeletion, GitHubClient } from "./github.js";

/** Options of the commit. */
export interface CommitOptions {
  /** The repository name with owner, e.g. "octocat/hello-world". */
  repository: string;
  baseBranch: string;
  headBranch: string;
  commitMessage: string;
  workingDirectory: string;
}

/** The subset of GitHubClient that commit() uses. */
export type Client = Pick<
  GitHubClient,
  "getRepositoryId" | "createBranch" | "createCommitOnBranch"
>;

/**
 * Splits a commit message into its headline and body.
 *
 * @param message The commit message.
 * @returns The headline and body.
 */
export function splitCommitMessage(message: string): {
  headline: string;
  body?: string;
} {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  const idx = normalized.indexOf("\n");
  if (idx < 0) {
    return { headline: normalized };
  }
  const headline = normalized.slice(0, idx).trim();
  const body = normalized.slice(idx + 1).trim();
  return body === "" ? { headline } : { headline, body };
}

/**
 * Commits all changes in the working directory via GitHub GraphQL API.
 *
 * @param options The options.
 * @param client The GitHub API client.
 * @returns The commit created, or undefined if there are no changes.
 */
export async function commit(
  options: CommitOptions,
  client: Client,
): Promise<Commit | undefined> {
  const cwd = options.workingDirectory;

  await stageAll(cwd);
  try {
    const changes = await getStagedChanges(cwd);
    if (changes.length === 0) {
      core.info("No changes to commit.");
      return undefined;
    }

    const additions: FileAddition[] = [];
    const deletions: FileDeletion[] = [];
    for (const change of changes) {
      if (change.status === "D" || change.newMode === FileMode.Missing) {
        core.info(`delete: ${change.path}`);
        deletions.push({ path: change.path });
        continue;
      }

      switch (change.newMode) {
        case FileMode.Submodule:
          throw new Error(
            `${change.path}: submodules are not supported by the createCommitOnBranch mutation`,
          );
        case FileMode.Symlink:
          core.warning(
            `${change.path}: symbolic links are not supported. it will be committed as a regular file.`,
          );
          break;
        case FileMode.Executable:
          if (change.oldMode !== FileMode.Executable) {
            core.warning(
              `${change.path}: the executable bit is not supported. it will be committed as a non-executable file.`,
            );
          }
          break;
      }

      core.info(`add: ${change.path}`);
      const contents = await readBlob(change.newSha, cwd);
      additions.push({
        path: change.path,
        contents: contents.toString("base64"),
      });
    }

    const headSha = await getHeadSha(cwd);
    if (options.headBranch !== options.baseBranch) {
      core.info(`creating a new branch ${options.headBranch} from ${headSha}`);
      const repositoryId = await client.getRepositoryId(options.repository);
      await client.createBranch(repositoryId, options.headBranch, headSha);
    }

    core.info(`creating a commit on ${options.headBranch}`);
    const created = await client.createCommitOnBranch({
      branch: {
        repositoryNameWithOwner: options.repository,
        branchName: options.headBranch,
      },
      expectedHeadOid: headSha,
      fileChanges: { additions, deletions },
      message: splitCommitMessage(options.commitMessage),
    });
    core.info(`created: ${created.url}`);
    return created;
  } finally {
    await unstageAll(cwd);
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    const baseBranch = core.getInput("base-branch", { required: true });
    const headBranch = core.getInput("head-branch") || baseBranch;
    const commitMessage =
      core.getInput("commit-message") ||
      `Auto updates by the ${process.env.GITHUB_WORKFLOW ?? ""} workflow`;
    const workingDirectory = path.resolve(
      core.getInput("working-directory") || ".",
    );
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
      throw new Error("GITHUB_REPOSITORY is not set");
    }

    const created = await commit(
      { repository, baseBranch, headBranch, commitMessage, workingDirectory },
      new GitHubClient(token),
    );
    if (created) {
      core.setOutput("commit-url", created.url);
      core.setOutput("commit-sha", created.oid);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}
