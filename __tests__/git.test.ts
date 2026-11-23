import { authEnv, parseRawDiff } from "../src/git.js";

describe("parseRawDiff", () => {
  it("parses an empty output", () => {
    expect(parseRawDiff("")).toEqual([]);
  });

  it("parses changes", () => {
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    const z = "0".repeat(40);
    const output = [
      `:100644 100644 ${a} ${b} M`,
      "update me.txt",
      `:000000 100644 ${z} ${b} A`,
      '"new"\nfile.txt',
      `:100644 000000 ${a} ${z} D`,
      "dir/delete-me.txt",
      "",
    ].join("\0");
    expect(parseRawDiff(output)).toEqual([
      {
        path: "update me.txt",
        oldMode: "100644",
        newMode: "100644",
        newSha: b,
        status: "M",
      },
      {
        path: '"new"\nfile.txt',
        oldMode: "000000",
        newMode: "100644",
        newSha: b,
        status: "A",
      },
      {
        path: "dir/delete-me.txt",
        oldMode: "100644",
        newMode: "000000",
        newSha: z,
        status: "D",
      },
    ]);
  });

  it("throws on unexpected output", () => {
    expect(() => parseRawDiff("foo\0bar\0")).toThrow(/unexpected output/);
  });
});

describe("authEnv", () => {
  it("resets existing extra headers and adds the token", () => {
    expect(authEnv("https://github.com/", "secret")).toEqual({
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_0: "",
      GIT_CONFIG_KEY_1: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_1: `AUTHORIZATION: basic ${Buffer.from("x-access-token:secret").toString("base64")}`,
    });
  });
});
