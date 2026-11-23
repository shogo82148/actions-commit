#!/usr/bin/env bash

set -uex

CURRENT=$(cd "$(dirname "$0")" && pwd)
cd "$CURRENT"

case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN*)
    # Windows has no executable bits, and creating symbolic links needs a privilege.
    # So git for Windows doesn't read them from the working tree (core.fileMode=false, core.symlinks=false),
    # and keeps the file modes recorded in the index instead.
    # Windows users change the modes via the index, so do it in the same way.
    git config core.fileMode false
    git config core.symlinks false

    # make an existing file executable
    git update-index --chmod=+x 'make-me-executable.txt'

    # add a new executable file
    printf '#!/bin/sh\necho hello\n' > 'new-executable.sh'
    git add 'new-executable.sh'
    git update-index --chmod=+x 'new-executable.sh'

    # add a symbolic link.
    # it is checked out as a plain file that contains the target path.
    printf '%s' 'update-me.txt' > 'symlink'
    git update-index --add --cacheinfo "120000,$(git hash-object -w 'symlink'),testdata/symlink"
    ;;
*)
    # make an existing file executable
    chmod +x 'make-me-executable.txt'

    # add a new executable file
    printf '#!/bin/sh\necho hello\n' > 'new-executable.sh'
    chmod +x 'new-executable.sh'

    # add a symbolic link
    ln -s 'update-me.txt' 'symlink'
    ;;
esac

# add a submodule
git init --quiet 'submodule'
git -C 'submodule' -c user.name=test -c user.email=test@example.com \
    commit --quiet --allow-empty -m 'init'
