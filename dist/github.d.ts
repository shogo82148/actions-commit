/** A file to be added or updated. */
export interface FileAddition {
    path: string;
    /** base64 encoded contents of the file. */
    contents: string;
}
/** A file to be deleted. */
export interface FileDeletion {
    path: string;
}
/** The input of the createCommitOnBranch mutation. */
export interface CreateCommitOnBranchInput {
    branch: {
        repositoryNameWithOwner: string;
        branchName: string;
    };
    expectedHeadOid: string;
    fileChanges: {
        additions: FileAddition[];
        deletions: FileDeletion[];
    };
    message: {
        headline: string;
        body?: string;
    };
}
/** A commit created. */
export interface Commit {
    oid: string;
    url: string;
}
/** A minimal client of GitHub GraphQL API. */
export declare class GitHubClient {
    private readonly token;
    private readonly endpoint;
    private readonly fetch;
    constructor(token: string, endpoint?: string, fetchImpl?: typeof fetch);
    /**
     * Calls GitHub GraphQL API.
     *
     * @param query The GraphQL query.
     * @param variables The variables of the query.
     * @returns The data of the response.
     */
    graphql<T>(query: string, variables: Record<string, unknown>): Promise<T>;
    /**
     * Gets the node ID of a repository.
     *
     * @param nameWithOwner The repository name with owner, e.g. "octocat/hello-world".
     * @returns The node ID of the repository.
     */
    getRepositoryId(nameWithOwner: string): Promise<string>;
    /**
     * Creates a new branch.
     *
     * @param repositoryId The node ID of the repository.
     * @param branch The name of the branch.
     * @param oid The SHA of the commit that the branch points to.
     */
    createBranch(repositoryId: string, branch: string, oid: string): Promise<void>;
    /**
     * Creates a new commit on a branch.
     *
     * @param input The input of the createCommitOnBranch mutation.
     * @returns The commit created.
     */
    createCommitOnBranch(input: CreateCommitOnBranchInput): Promise<Commit>;
}
