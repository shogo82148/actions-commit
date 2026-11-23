import { jest } from "@jest/globals";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { git } from "../src/git.js";
import type { CreateCommitOnBranchInput } from "../src/github.js";
import { Client, commit, splitCommitMessage } from "../src/main.js";

const gitConfig = [
  "-c",
  "user.name=test",
  "-c",
  "user.email=test@example.com",
  "-c",
  "commit.gpgsign=false",
];

async function setupRepository(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actions-commit-"));
  await git(["init", "--quiet"], dir);
  await fs.writeFile(path.join(dir, '"please delete me".txt'), "delete\n");
  await fs.writeFile(path.join(dir, "rename-me.txt"), "rename\n");
  await fs.writeFile(path.join(dir, "update-me.txt"), "please update me!\n");
  await fs.mkdir(path.join(dir, "sub"));
  await fs.writeFile(path.join(dir, "sub", "keep.txt"), "keep\n");
  await git(["add", "."], dir);
  await git([...gitConfig, "commit", "--quiet", "-m", "initial"], dir);
  return dir;
}

function fakeClient() {
  const calls: CreateCommitOnBranchInput[] = [];
  const client = {
    getRepositoryId: jest.fn(async () => "R_123"),
    createBranch: jest.fn(async () => {}),
    createCommitOnBranch: jest.fn(async (input: CreateCommitOnBranchInput) => {
      calls.push(input);
      return { oid: "c0ffee", url: "https://github.com/o/r/commit/c0ffee" };
    }),
  };
  return { client: client as Client & typeof client, calls };
}

const decode = (s: string) => Buffer.from(s, "base64").toString("utf8");

describe("splitCommitMessage", () => {
  it("returns the headline only", () => {
    expect(splitCommitMessage("hello\n")).toEqual({ headline: "hello" });
  });

  it("splits the headline and the body", () => {
    expect(splitCommitMessage("hello\r\n\r\nworld\nfoo")).toEqual({
      headline: "hello",
      body: "world\nfoo",
    });
  });
});

describe("commit", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await setupRepository();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("does nothing if there are no changes", async () => {
    const { client } = fakeClient();
    const result = await commit(
      {
        repository: "o/r",
        baseBranch: "main",
        headBranch: "main",
        commitMessage: "msg",
        workingDirectory: dir,
      },
      client,
    );
    expect(result).toBeUndefined();
    expect(client.createCommitOnBranch).not.toHaveBeenCalled();
    expect(client.createBranch).not.toHaveBeenCalled();
  });

  it("commits all changes", async () => {
    await fs.rm(path.join(dir, '"please delete me".txt'));
    await fs.rename(
      path.join(dir, "rename-me.txt"),
      path.join(dir, "renamed!.txt"),
    );
    await fs.appendFile(path.join(dir, "update-me.txt"), "UPDATED!!\n");
    await fs.writeFile(path.join(dir, '"new file".txt'), "brand new\n");
    const head = (await git(["rev-parse", "HEAD"], dir)).toString().trim();

    const { client, calls } = fakeClient();
    const result = await commit(
      {
        repository: "o/r",
        baseBranch: "main",
        headBranch: "main",
        commitMessage: "headline\n\nbody",
        workingDirectory: dir,
      },
      client,
    );

    expect(result).toEqual({
      oid: "c0ffee",
      url: "https://github.com/o/r/commit/c0ffee",
    });
    expect(client.createBranch).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    const input = calls[0];
    expect(input.branch).toEqual({
      repositoryNameWithOwner: "o/r",
      branchName: "main",
    });
    expect(input.expectedHeadOid).toBe(head);
    expect(input.message).toEqual({ headline: "headline", body: "body" });

    const additions = Object.fromEntries(
      input.fileChanges.additions.map((a) => [a.path, decode(a.contents)]),
    );
    expect(additions).toEqual({
      '"new file".txt': "brand new\n",
      "renamed!.txt": "rename\n",
      "update-me.txt": "please update me!\nUPDATED!!\n",
    });
    expect(input.fileChanges.deletions.map((d) => d.path).sort()).toEqual([
      '"please delete me".txt',
      "rename-me.txt",
    ]);

    // the index should be restored.
    const staged = await git(["diff", "--cached", "--name-only"], dir);
    expect(staged.toString()).toBe("");
  });

  it("creates a new branch", async () => {
    await fs.writeFile(path.join(dir, "new.txt"), "new\n");
    const head = (await git(["rev-parse", "HEAD"], dir)).toString().trim();

    const { client, calls } = fakeClient();
    await commit(
      {
        repository: "o/r",
        baseBranch: "main",
        headBranch: "topic",
        commitMessage: "msg",
        workingDirectory: dir,
      },
      client,
    );

    expect(client.getRepositoryId).toHaveBeenCalledWith("o/r");
    expect(client.createBranch).toHaveBeenCalledWith("R_123", "topic", head);
    expect(calls[0].branch.branchName).toBe("topic");
  });

  it("commits only changes under the working directory", async () => {
    await fs.writeFile(path.join(dir, "outside.txt"), "outside\n");
    await fs.writeFile(path.join(dir, "sub", "inside.txt"), "inside\n");

    const { client, calls } = fakeClient();
    await commit(
      {
        repository: "o/r",
        baseBranch: "main",
        headBranch: "main",
        commitMessage: "msg",
        workingDirectory: path.join(dir, "sub"),
      },
      client,
    );

    // paths are relative to the repository root.
    expect(calls[0].fileChanges.additions.map((a) => a.path)).toEqual([
      "sub/inside.txt",
    ]);
    expect(calls[0].fileChanges.deletions).toEqual([]);
  });

  it("unstages changes even if the API fails", async () => {
    await fs.writeFile(path.join(dir, "new.txt"), "new\n");

    const { client } = fakeClient();
    client.createCommitOnBranch.mockRejectedValueOnce(new Error("boom"));
    await expect(
      commit(
        {
          repository: "o/r",
          baseBranch: "main",
          headBranch: "main",
          commitMessage: "msg",
          workingDirectory: dir,
        },
        client,
      ),
    ).rejects.toThrow("boom");

    const staged = await git(["diff", "--cached", "--name-only"], dir);
    expect(staged.toString()).toBe("");
  });
});
