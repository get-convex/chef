set shell := ["bash", "-uc"]
set positional-arguments

# (*) Run convex CLI commands like `convex dev` against local big brain from `just run-big-brain` (i.e. for Dashboard development).
convex-bb command *ARGS:
    #!/usr/bin/env bash
    set -e
    export CONVEX_PROVISION_HOST=http://0.0.0.0:8050
    if [[ -n "$CONVEX_OVERRIDE_ACCESS_TOKEN" ]]; then echo "Plz unset CONVEX_OVERRIDE_ACCESS_TOKEN"; exit 1; fi
    cd {{invocation_directory()}}
    if [ "$1" == "dev" ] || [ "$1" == "login" ]; then
        npx convex "$1" --override-auth-url "https://cheerful-lake-55-staging.authkit.app/" --override-auth-client "client_01K1EFJ1R8YHBZ131A4VDN433S" "${@:2}"
    else
        npx convex "$@"
    fi
