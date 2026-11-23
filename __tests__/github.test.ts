import { jest } from "@jest/globals";
import { GitHubClient } from "../src/github.js";

function fakeFetch(status: number, body: unknown) {
  return jest.fn<(input: string, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

describe("GitHubClient", () => {
  it("sends a GraphQL request", async () => {
    const fetch = fakeFetch(200, {
      data: {
        createCommitOnBranch: {
          commit: { oid: "abc", url: "https://example.com/abc" },
        },
      },
    });
    const client = new GitHubClient(
      "token",
      "https://api.example.com/graphql",
      fetch as unknown as typeof globalThis.fetch,
    );
    const commit = await client.createCommitOnBranch({
      branch: { repositoryNameWithOwner: "o/r", branchName: "main" },
      expectedHeadOid: "0123",
      fileChanges: { additions: [], deletions: [] },
      message: { headline: "hello" },
    });

    expect(commit).toEqual({ oid: "abc", url: "https://example.com/abc" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/graphql");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "bearer token",
    );
    const body = JSON.parse(init?.body as string);
    expect(body.variables.input.expectedHeadOid).toBe("0123");
  });

  it("throws GraphQL errors", async () => {
    const fetch = fakeFetch(200, {
      data: null,
      errors: [{ message: "something wrong" }],
    });
    const client = new GitHubClient(
      "token",
      "https://api.example.com/graphql",
      fetch as unknown as typeof globalThis.fetch,
    );
    await expect(client.getRepositoryId("o/r")).rejects.toThrow(
      /something wrong/,
    );
  });

  it("throws HTTP errors", async () => {
    const fetch = fakeFetch(401, { message: "Bad credentials" });
    const client = new GitHubClient(
      "token",
      "https://api.example.com/graphql",
      fetch as unknown as typeof globalThis.fetch,
    );
    await expect(client.createBranch("R_1", "topic", "0123")).rejects.toThrow(
      /401/,
    );
  });
});
