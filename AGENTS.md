# Agent Instructions (Project: htown)

## Avoid getting stuck on huge searches or outputs
- When using `rg`, **always** exclude heavy/binary/asset dirs unless explicitly requested: `assets`, `assetsext`, `node_modules`, `logs`, `test-results`.
- Also exclude build/compiled/output dirs (e.g. `dist`, `client/dist`, `codex_prompt_suite_3d_chase_cam`) unless the task explicitly targets them.
- Prefer targeted searches with `-g` include patterns and `--max-count 200` (or lower) to prevent runaway output.
- If a command starts dumping huge results, **stop and refine** the query; do not try to parse the entire output.
- Do not open or process large files unless they are explicitly part of the task.
