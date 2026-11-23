#!/usr/bin/env bash

# verify that the commit created by the action has the same tree as the local changes.
# usage: verify.sh COMMIT_SHA

set -ue

SHA=$1

CURRENT=$(cd "$(dirname "$0")" && pwd)
cd "$CURRENT/.."

git add --all .
EXPECTED_TREE=$(git write-tree)
git reset --quiet HEAD

ACTUAL_TREE=$(gh api "repos/$GITHUB_REPOSITORY/git/commits/$SHA" --jq '.tree.sha')
if [[ "$EXPECTED_TREE" != "$ACTUAL_TREE" ]]; then
    echo "::error::tree is not matched. expected: $EXPECTED_TREE, actual: $ACTUAL_TREE"
    gh api "repos/$GITHUB_REPOSITORY/git/trees/$ACTUAL_TREE?recursive=1" --jq '.tree[] | "\(.mode) \(.type) \(.sha) \(.path)"'
    exit 1
fi
echo "tree is OK."

VERIFIED=$(gh api "repos/$GITHUB_REPOSITORY/commits/$SHA" --jq '.commit.verification.verified')
if [[ "$VERIFIED" != "true" ]]; then
    echo "::error::the commit $SHA is not verified."
    exit 1
fi
echo "signature is OK."
