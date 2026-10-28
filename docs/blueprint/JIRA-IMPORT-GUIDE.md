# Jira import guide — Oostervelde Invoice Check (key OIC)

File: `jira-import.csv` (7 epics, 35 stories, 107 points). Nothing is pushed to Jira automatically.

## Steps
1. Create a Jira project with key **OIC** (project creation is admin-only; do it in the UI), or use an existing project and adjust the key.
2. Jira → ⚙ → System → External System Import → **CSV** → upload `jira-import.csv` (UTF-8, comma delimiter).
3. Map the columns:

| CSV column | Jira field |
|---|---|
| Issue ID | **Issue Key** (or "Issue id" / external key used to resolve links) |
| Issue Type | Issue Type (Epic / Story) |
| Summary | Summary |
| Description | Description (contains story, acceptance checklist, mapping) |
| Epic Name | Epic Name (epics only) |
| Epic Link | Epic Link (stories point at the epic by name) |
| Priority | Priority (Highest/High/Medium/Low) |
| Story Points | Story point estimate |
| Status | Status (map Draft→To Do, Ready→Ready/To Do, In Progress→In Progress, Done→Done) |
| Labels | Labels (space-separated: wave, workstream, sprint, epic, phase, priority) |
| Sprint | Sprint (S1–S4; create sprints first) |
| Wave / Workstream | Custom text fields, or ignore (already in Labels) |
| Blocked By | Issue link "is blocked by" using the Issue IDs (US-xxx) |

4. Import epics first if Jira asks for order; stories resolve `Epic Link` by epic name.

## Notes
- Labels duplicate wave/workstream/sprint/epic/phase/priority, so the plan works without custom fields.
- `Blocked By` only lists real story IDs that exist in this file.
- Statuses reflect the state when the file was generated; re-run `python3 docs/blueprint/build_blueprint.py` after editing it.
