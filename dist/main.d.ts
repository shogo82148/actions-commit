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
export type Client = Pick<GitHubClient, "getRepositoryId" | "createBranch" | "createCommitOnBranch">;
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
 * Commits all changes in the working directory via GitHub GraphQL API.
 *
 * @param options The options.
 * @param client The GitHub API client.
 * @returns The commit created, or undefined if there are no changes.
 */
export declare function commit(options: CommitOptions, client: Client): Promise<Commit | undefined>;
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export declare function run(): Promise<void>;
