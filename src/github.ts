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

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/** A minimal client of GitHub GraphQL API. */
export class GitHubClient {
  private readonly token: string;
  private readonly endpoint: string;
  private readonly fetch: typeof fetch;

  constructor(
    token: string,
    endpoint: string = process.env.GITHUB_GRAPHQL_URL ||
      "https://api.github.com/graphql",
    fetchImpl: typeof fetch = globalThis.fetch,
  ) {
    this.token = token;
    this.endpoint = endpoint;
    this.fetch = fetchImpl;
  }

  /**
   * Calls GitHub GraphQL API.
   *
   * @param query The GraphQL query.
   * @param variables The variables of the query.
   * @returns The data of the response.
   */
  async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const res = await this.fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "shogo82148/actions-commit",
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `GitHub GraphQL API returned ${res.status} ${res.statusText}: ${text}`,
      );
    }
    const json = JSON.parse(text) as GraphQLResponse<T>;
    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GitHub GraphQL API returned errors: ${json.errors.map((e) => e.message).join("; ")}`,
      );
    }
    if (json.data === undefined || json.data === null) {
      throw new Error("GitHub GraphQL API returned no data");
    }
    return json.data;
  }

  /**
   * Gets the node ID of a repository.
   *
   * @param nameWithOwner The repository name with owner, e.g. "octocat/hello-world".
   * @returns The node ID of the repository.
   */
  async getRepositoryId(nameWithOwner: string): Promise<string> {
    const [owner, name] = nameWithOwner.split("/", 2);
    const data = await this.graphql<{ repository: { id: string } | null }>(
      `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) { id }
      }`,
      { owner, name },
    );
    if (!data.repository) {
      throw new Error(`repository ${nameWithOwner} is not found`);
    }
    return data.repository.id;
  }

  /**
   * Creates a new branch.
   *
   * @param repositoryId The node ID of the repository.
   * @param branch The name of the branch.
   * @param oid The SHA of the commit that the branch points to.
   */
  async createBranch(
    repositoryId: string,
    branch: string,
    oid: string,
  ): Promise<void> {
    await this.graphql(
      `mutation ($input: CreateRefInput!) {
        createRef(input: $input) { clientMutationId }
      }`,
      {
        input: {
          repositoryId,
          name: `refs/heads/${branch}`,
          oid,
        },
      },
    );
  }

  /**
   * Creates a new commit on a branch.
   *
   * @param input The input of the createCommitOnBranch mutation.
   * @returns The commit created.
   */
  async createCommitOnBranch(
    input: CreateCommitOnBranchInput,
  ): Promise<Commit> {
    const data = await this.graphql<{
      createCommitOnBranch: { commit: Commit };
    }>(
      `mutation ($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid url }
        }
      }`,
      { input },
    );
    return data.createCommitOnBranch.commit;
  }
}
