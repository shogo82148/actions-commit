#!/usr/bin/env bash

# delete the branch created by the test.
# usage: cleanup.sh BRANCH

set -ue

BRANCH=$1

# the branch may not exist if the test failed before creating it.
if ! gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$BRANCH" --silent 2>/dev/null; then
    echo "the branch $BRANCH does not exist. nothing to do."
    exit 0
fi

gh api --method DELETE "repos/$GITHUB_REPOSITORY/git/refs/heads/$BRANCH" --silent
echo "deleted the branch $BRANCH."
