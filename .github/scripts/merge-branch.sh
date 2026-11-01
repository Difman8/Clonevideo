#!/usr/bin/env bash
# Merges $SHA (the pushed branch) into main after a typecheck, and records it in CHANGELOG.md.
# The push uses GITHUB_TOKEN, so it does not trigger other workflows (no loops).
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# An open PR for this branch gives a nicer title; otherwise use the last commit subject.
PR_JSON=$(gh pr list --head "$BRANCH" --state open --json number,title,url --jq '.[0] // empty' 2>/dev/null || true)
if [ -n "$PR_JSON" ]; then
  TITLE=$(jq -r .title <<<"$PR_JSON")
  CL_LINK="[#$(jq -r .number <<<"$PR_JSON")]($(jq -r .url <<<"$PR_JSON"))"
else
  TITLE=$(git log -1 --format=%s "$SHA")
  CL_LINK="nhánh \`$BRANCH\`"
fi

typechecked=""
for attempt in 1 2 3; do
  git fetch -q origin main
  git checkout -q -B main origin/main
  if git merge-base --is-ancestor "$SHA" HEAD; then
    echo "Nhánh $BRANCH đã có trong main, không cần gộp."
    exit 0
  fi
  BASE=$(git rev-parse HEAD)

  if ! git merge -q --no-ff --no-commit "$SHA"; then
    git merge --abort || true
    echo "::error::Nhánh $BRANCH xung đột với main. Cần gộp tay (hoặc nhờ Claude sửa xung đột trên nhánh rồi đẩy lại)."
    exit 1
  fi

  if [ -z "$typechecked" ]; then
    if ! (cd remotion-remake && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error && npx tsc -p .); then
      echo "::error::Code trên nhánh $BRANCH không qua kiểm tra TypeScript nên chưa được gộp vào main."
      exit 1
    fi
    typechecked=1
  fi

  CL_TITLE="$TITLE" CL_AUTHOR="$ACTOR" CL_LINK="$CL_LINK" \
    CL_COMMITS="$(git log --no-merges --format=%s "$BASE..$SHA")" \
    node .github/scripts/changelog.mjs
  git add CHANGELOG.md
  git commit -q -m "Gộp $BRANCH: $TITLE"

  if git push -q origin main; then
    echo "Đã gộp $BRANCH vào main."
    exit 0
  fi
  echo "main vừa thay đổi, thử lại ($attempt)..."
done

echo "::error::Không đẩy được lên main sau 3 lần thử."
exit 1
