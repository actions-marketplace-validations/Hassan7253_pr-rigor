#!/usr/bin/env python3
"""Reference agents used to validate the agentic evaluation harness itself.

The robust profile follows the task regardless of irrelevant workspace noise.
The brittle profile intentionally fails when a perturbation file exists, giving
CI a known-negative control that demonstrates the evaluation can expose
non-robust behavior.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path


def write_event(workspace: Path, event: dict) -> None:
    with (workspace / "agent-events.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, sort_keys=True) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True)
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--profile", choices=["robust", "brittle"], default="robust")
    args = ap.parse_args()
    task = json.loads(Path(args.task).read_text(encoding="utf-8"))
    ws = Path(args.workspace)
    write_event(ws, {"type": "inspect", "task_id": task["id"]})

    if args.profile == "brittle" and (ws / "notes" / "irrelevant.txt").exists():
        write_event(ws, {"type": "abort", "reason": "unexpected workspace noise"})
        return 0

    tid = task["id"]
    if tid == "json-config-threshold":
        p = ws / "config.json"; data = json.loads(p.read_text()); data["quality"]["threshold"] = 0.90; p.write_text(json.dumps(data, indent=2) + "\n")
    elif tid == "readme-required-heading":
        p = ws / "README.md"; p.write_text(p.read_text() + "\n## Validation\n\nRun npm test before release.\n")
    elif tid == "js-timeout-default":
        p = ws / "src/config.js"; p.write_text(p.read_text().replace("DEFAULT_TIMEOUT_MS = 5000", "DEFAULT_TIMEOUT_MS = 8000"))
    elif tid == "python-retry-count":
        p = ws / "retry.py"; p.write_text(p.read_text().replace("MAX_RETRIES = 2", "MAX_RETRIES = 4"))
    elif tid == "policy-forbidden-secret":
        p = ws / "app.env.example"; p.write_text("API_TOKEN=<set-at-runtime>\n")
    elif tid == "preserve-unrelated-config":
        p = ws / "settings.json"; data = json.loads(p.read_text()); data["features"]["eval_lab"] = True; p.write_text(json.dumps(data, indent=2) + "\n")
    else:
        raise ValueError(f"unknown task: {tid}")

    write_event(ws, {"type": "edit", "task_id": tid})
    write_event(ws, {"type": "finish", "task_id": tid})
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
