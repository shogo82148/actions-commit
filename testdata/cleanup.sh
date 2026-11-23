#!/usr/bin/env bash

# delete the branch created by the test.
# usage: cleanup.sh BRANCH

set -ue

BRANCH=$1

# the branch may not exist if the test failed before creating it.
# treat only a confirmed 404 as "missing", and report any other failure.
ERRORS=$(mktemp)
trap 'rm -f "$ERRORS"' EXIT
if ! RESPONSE=$(gh api --include "repos/$GITHUB_REPOSITORY/git/ref/heads/$BRANCH" 2>"$ERRORS"); then
    # the first line of the response is the status line, e.g. "HTTP/2.0 404 Not Found".
    # it is empty if the request didn't reach GitHub (e.g. network errors).
    STATUS=$(printf '%s\n' "$RESPONSE" | head -n 1 | awk '{ print $2 }')
    if [[ "$STATUS" = "404" ]]; then
        echo "the branch $BRANCH does not exist. nothing to do."
        exit 0
    fi
    echo "::error::failed to look up the branch $BRANCH (status: ${STATUS:-none})"
    cat "$ERRORS" >&2
    printf '%s\n' "$RESPONSE" >&2
    exit 1
fi

gh api --method DELETE "repos/$GITHUB_REPOSITORY/git/refs/heads/$BRANCH" --silent
echo "deleted the branch $BRANCH."
