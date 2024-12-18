#!/usr/bin/env bash

set -ue
set -o pipefail

if [[ ${RUNNER_DEBUG:-} = '1' ]]; then
    set -x
fi

# check whether there is any changes.
git add .
if git diff --cached --exit-code --quiet; then
    echo "No changes to commit." >&2
    exit
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# additions
git diff -z --name-only --cached --no-renames --diff-filter=d | \
    xargs -0 -n1 bash -c \
    "git show \":0:\$0\" | base64 -w 0 | jq --arg path \"\$0\" --raw-input --slurp --compact-output '{ path: \$path, contents: . }'" \
    > "$TMPDIR/additions.txt"

# deletions
git diff -z --name-only --cached --no-renames --diff-filter=D | \
    jq --raw-input --slurp 'split("\u0000") | .[0:-1] | { path: . }' \
    > "$TMPDIR/deletions.txt"

SHA_BEFORE=$(git rev-parse HEAD)

# set the default value if they are not configured.
: "${INPUT_HEAD_BRANCH:=$INPUT_BASE_BRANCH}"
: "${INPUT_COMMIT_MESSAGE:=Auto updates by the $GITHUB_WORKFLOW workflow}"

# create a branch if needed
if [[ "$INPUT_HEAD_BRANCH" != "$INPUT_BASE_BRANCH" ]]; then
    jq --null-input \
        --arg query 'mutation ($input: CreateRefInput!) {
            createRef(input: $input) {
                clientMutationId
            }
        }' \
        --arg branch "refs/heads/$INPUT_HEAD_BRANCH" \
        --arg repositoryId "$(gh repo view --json id --jq '.id')"\
        --arg oid "$SHA_BEFORE" \
        '{
            query: $query,
            variables: {
                input: {
                    repositoryId: $repositoryId,
                    name: $branch,
                    oid: $oid
                }
            }
        }' \
        > "$TMPDIR/query-create-branch.txt"

    : show the query for debugging
    if [[ ${RUNNER_DEBUG:-} = '1' ]]; then
        cat "$TMPDIR/query-create-branch.txt" >&2
    fi

    : "$(gh api graphql --input "$TMPDIR/query-create-branch.txt")"
fi

# create a commit
jq --null-input \
    --slurpfile additions "$TMPDIR/additions.txt" \
    --slurpfile deletions "$TMPDIR/deletions.txt" \
    --arg expectedHeadOid "$SHA_BEFORE" \
    --arg query 'mutation ($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
            commit { url }
        }
    }' \
    --arg message "${INPUT_COMMIT_MESSAGE}" \
    '{
        query: $query,
        variables: {
            input: {
                branch: {
                    repositoryNameWithOwner: env.GITHUB_REPOSITORY,
                    branchName: env.INPUT_HEAD_BRANCH,
                },
                fileChanges: {
                    additions: $additions,
                    deletions: $deletions
                },
                expectedHeadOid: $expectedHeadOid,
                message: {
                    headline: $message
                }
            }
        }
    }' \
    > "$TMPDIR/query-create-commit.txt"

: show the query for debugging
if [[ ${RUNNER_DEBUG:-} = '1' ]]; then
    cat "$TMPDIR/query-create-commit.txt" >&2
fi
COMMIT_URL=$(gh api graphql --input "$TMPDIR/query-create-commit.txt" --jq '.data.createCommitOnBranch.commit.url')

git reset HEAD > /dev/null 2>&1

cat <<__END_OF_OUTPUT__ >> "$GITHUB_OUTPUT"
commit-url=$COMMIT_URL
__END_OF_OUTPUT__
