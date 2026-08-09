# Agentic Eval Lab

This development-only lab evaluates **agent behavior inside synthetic coding environments**. It extends PR Rigor's evaluator-of-the-evaluator philosophy from deterministic PR signals to agentic task execution without changing the core Action's privacy or dependency model.

The lab is intentionally vendor-neutral. A runner creates a fresh workspace for every episode, applies semantically irrelevant environment perturbations, invokes a trusted local agent command, grades observable outcomes with deterministic oracles, repeats trials, and reports uncertainty and failure classes.

## Research question

> What did the system actually learn to do, and does the measurement deserve to be believed?

## What it measures

- task success across repeated trials
- 95% Wilson confidence interval for success
- grader-score variance
- **environment consistency** under irrelevant workspace perturbations
- slice metrics by task category
- failure taxonomy: task, agent, timeout, grader, or harness failure
- paired bootstrap comparison against a committed baseline

The key distinction is between **benchmark movement** and **evidence of capability**. A brittle agent that only works in the exact clean fixture should score worse than one that succeeds under behaviorally irrelevant environment changes.

## Run the known-good reference

```bash
python evals/agentic/run_agent_evals.py \
  --agent "python evals/agentic/fixture_agent.py --profile robust" \
  --repeat 3 \
  --out evals/out/agentic
```

Run the intentionally brittle negative control:

```bash
python evals/agentic/run_agent_evals.py \
  --agent "python evals/agentic/fixture_agent.py --profile brittle" \
  --repeat 3 \
  --out evals/out/agentic-brittle
```

The negative control is part of the validation story: the harness should demonstrate that it can detect a known robustness failure rather than merely emit attractive metrics.

## Bring your own coding agent

The `--agent` command must accept:

```text
--task <task.json> --workspace <directory>
```

The task JSON includes an instruction and deterministic grader specification. The agent may inspect and edit only the synthetic workspace. The harness then grades the resulting files. This keeps the protocol model-agnostic and makes saved runs reproducible.

> Security: `--agent` executes a local command. Only use commands you trust. The CI workflow uses the included fixture agent; it does not execute pull-request code and does not send repository data to an external model.

## Why this lives beside PR Rigor

PR Rigor asks whether a pull request carries enough observable evidence for focused review. The original Eval Lab asks whether PR Rigor's deterministic rules are themselves accurate. Agentic Eval Lab asks the next measurement question: whether a task environment and grader continue to distinguish robust behavior from brittle behavior when irrelevant details change.
