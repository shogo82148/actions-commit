#!/usr/bin/env bash

set -uex

CURRENT=$(cd "$(dirname "$0")" && pwd)
cd "$CURRENT"

rm 'please delete me.txt'
mv 'rename-me.txt' 'renamed!.txt'
echo 'UPDATED!!' >> 'update-me.txt'

case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN*)
    # double quotes are not allowed in file names on Windows.
    echo "it's a brand new file" > 'new file.txt'
    ;;
*)
    # git quotes this name unless -z is used.
    echo "it's a brand new file" > '"new file".txt'
    ;;
esac
