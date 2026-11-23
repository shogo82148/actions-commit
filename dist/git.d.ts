/**
 * Runs a git command and returns its standard output.
 *
 * @param args The arguments passed to git.
 * @param cwd The working directory.
 * @returns The standard output of the command.
 */
export declare function git(args: string[], cwd: string): Promise<Buffer>;
/** File modes of git objects. */
export declare const FileMode: {
    readonly Regular: "100644";
    readonly Executable: "100755";
    readonly Symlink: "120000";
    readonly Submodule: "160000";
    readonly Missing: "000000";
};
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
export declare function parseRawDiff(output: string): StagedChange[];
/**
 * Stages all changes under the working directory.
 *
 * @param cwd The working directory.
 */
export declare function stageAll(cwd: string): Promise<void>;
/**
 * Unstages all changes.
 *
 * @param cwd The working directory.
 */
export declare function unstageAll(cwd: string): Promise<void>;
/**
 * Lists the staged changes.
 *
 * @param cwd The working directory.
 * @returns The list of the staged changes.
 */
export declare function getStagedChanges(cwd: string): Promise<StagedChange[]>;
/**
 * Reads the contents of a blob.
 *
 * @param sha The SHA of the blob.
 * @param cwd The working directory.
 * @returns The contents of the blob.
 */
export declare function readBlob(sha: string, cwd: string): Promise<Buffer>;
/**
 * Resolves the commit SHA of HEAD.
 *
 * @param cwd The working directory.
 * @returns The SHA of HEAD.
 */
export declare function getHeadSha(cwd: string): Promise<string>;
