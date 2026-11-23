import { StagedChange } from "./git.js";
import { Commit, GitHubClient } from "./github.js";
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
export type Client = Pick<GitHubClient, "getRepositoryId" | "createBranch" | "createCommitOnBranch" | "createBlob" | "createTree" | "createCommit" | "createRef" | "updateRef">;
/**
 * Splits a commit message into its headline and body.
 *
 * @param message The commit message.
 * @returns The headline and body.
 */
export declare function splitCommitMessage(message: string): {
    headline: string;
    body?: string;
};
/**
 * Reports whether the change can be committed by the createCommitOnBranch mutation.
 * The mutation supports only regular files.
 *
 * @param change The change.
 * @returns true if the mutation supports the change.
 */
export declare function isRegularFileChange(change: StagedChange): boolean;
/**
 * Commits all changes in the working directory via GitHub API.
 *
 * If all changes are regular files, the commit is created by the
 * createCommitOnBranch GraphQL mutation. Otherwise (executable files,
 * symbolic links or submodules are involved), it is created by the Git
 * Database REST API, because the mutation doesn't support file modes.
 *
 * @param options The options.
 * @param client The GitHub API client.
 * @returns The commit created, or undefined if there are no changes.
 */
export declare function commit(options: CommitOptions, client: Client): Promise<Commit | undefined>;
/** Options of the checkout after the commit. */
export interface CheckoutOptions {
    workingDirectory: string;
    /** The branch that the commit was created on. */
    headBranch: string;
    /** The URL of the remote repository, e.g. "https://github.com/octocat/hello-world". */
    remoteUrl: string;
    /** Additional environment variables for git fetch, e.g. authEnv(). */
    env?: Record<string, string>;
}
/**
 * Fetches the commit created by the API, and checks out the head branch at the commit.
 * After that, HEAD points to the commit and the working tree is clean
 * (except changes that are not committed, e.g. outside of the working directory).
 *
 * @param options The options.
 * @param sha The SHA of the commit.
 */
export declare function checkout(options: CheckoutOptions, sha: string): Promise<void>;
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export declare function run(): Promise<void>;
