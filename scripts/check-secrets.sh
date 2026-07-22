#!/bin/sh
# Block files containing likely secrets (API keys, tokens, passwords)
# Patterns known to trigger: AWS keys, generic API keys, tokens, passwords

BLOCKED_PATTERNS="
AKIA[0-9A-Z]{16}
sk-[a-zA-Z0-9]{20,}
sk-[a-zA-Z0-9-_.]{30,}
pk-[a-zA-Z0-9-_.]{30,}
xox[bpras]-[0-9a-zA-Z]{10,}
ghp_[0-9a-zA-Z]{36}
gho_[0-9a-zA-Z]{36}
ghu_[0-9a-zA-Z]{36}
ghs_[0-9a-zA-Z]{36}
ghr_[0-9a-zA-Z]{36}
-----BEGIN (RSA |EC |OPENSSH |PGP )PRIVATE KEY-----
"

EXIT_CODE=0
for FILE in "$@"; do
  # Skip binary files, lockfiles, and common false positives
  case "$FILE" in
    *.lock | *.svg | *.png | *.jpg | *.jpeg | *.gif | *.ico | *.woff* | *.eot | *.ttf | *.pyc | .secrets.baseline)
      continue
      ;;
  esac
  [ ! -f "$FILE" ] && continue

  while IFS= read -r PATTERN; do
    [ -z "$PATTERN" ] && continue
    if grep -qE "$PATTERN" "$FILE" 2>/dev/null; then
      echo "⚠️  Possible secret found in $FILE (matches: $PATTERN)"
      EXIT_CODE=1
    fi
  done <<PATTERNS_EOF
$BLOCKED_PATTERNS
PATTERNS_EOF
done

exit $EXIT_CODE
