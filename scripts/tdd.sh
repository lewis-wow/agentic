# Try critical priority first
ISSUE=$(gh issue list --label "priority:critical" --limit 1 --json number,title,body)

# Fallback to high priority if nothing is found
if [ "$ISSUE" = "[]" ]
then
  ISSUE=$(gh issue list --label "priority:high" --limit 1 --json number,title,body)
fi

# Fallback to medium priority if still empty
if [ "$ISSUE" = "[]" ]
then
  ISSUE=$(gh issue list --label "priority:medium" --limit 1 --json number,title,body)
fi

# Fallback to the first open issue regardless of labels
if [ "$ISSUE" = "[]" ]
then
  ISSUE=$(gh issue list --limit 1 --json number,title,body)
fi

# Fail-safe check for completely empty repository
if [ "$ISSUE" = "[]" ]
then
  echo "No open issues found in the repository"
  exit 0
fi

# Execute the TDD skill with the retrieved issue
claude /tdd "$ISSUE"
