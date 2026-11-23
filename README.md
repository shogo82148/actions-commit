# Commit Action

Commit all changes to a new branch, create a pull request.
The action uses the GraphQL API instead of the `git` command.
Commits authored using the action are automatically GPG signed and
are [marked as verified](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) on the GitHub UI.

## Synopsis

```yaml
name: auto update
on:
  push:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: make some changes
        run: ": do something"

      - name: commit
        uses: shogo82148/actions-commit@v1
```

## How it works

The action stages all changes in the `working-directory` and sends them to GitHub through the API.
How the commit is created depends on the changes.

- If all changes are regular files, the commit is created by the [createCommitOnBranch](https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch) mutation of the GraphQL API.
  The commit is signed by GitHub with any token, including personal access tokens.
- If the changes involve executable files, symbolic links, or submodules, the commit is created by the [Git Database REST API](https://docs.github.com/en/rest/git) (blobs, trees, commits, and refs),
  because the createCommitOnBranch mutation doesn't support file modes.
  In this case, whether the commit is signed depends on the token.
  The commit created with `${{ github.token }}` is signed and verified,
  but the commit created with a token that authenticates as a user (e.g. a personal access token) is not signed.
  See [Signature verification for bots](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification#signature-verification-for-bots).
  The action shows a warning if the commit is not verified.

## Inputs

### github-token

The GitHub Token. The default is `${{ github.token }}`

### base-branch

The base branch. The default is the branch name that triggered the workflow run. ( `${{ github.ref_name }}` )

### head-branch

The head branch. The default is same as `base-branch`.

### commit-message

The commit message.
The default is "Auto updates by the $GITHUB_WORKFLOW workflow".
If the message has multiple lines, the first line is used as the headline, and the rest is used as the body.

### working-directory

The working directory. The default is `.`.
Only the changes under the directory are committed.

## Outputs

### commit-url

The URL of the commit created.

### commit-sha

The SHA of the commit created.

## Related Works

- [Create Pull Request](https://github.com/marketplace/actions/create-pull-request) Action

## See Also

- [A simpler API for authoring commits](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/)
- [GitHub GraphQL API で新しいブランチを作成する](https://int128.hatenablog.com/entry/2020/01/15/165432)
