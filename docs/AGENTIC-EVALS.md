# Agentic evaluation methodology

Agentic Eval Lab is a small, auditable research harness for coding-agent evaluation. It is not presented as a frontier benchmark. Its purpose is to make the measurement assumptions explicit and testable.

## Episode model

Each episode contains a task, a fresh synthetic workspace, one environment perturbation, one agent execution, and deterministic graders. Repeats estimate run-to-run variation. Equivalent perturbations test whether a score is sensitive to irrelevant environment details.

## Measurement contract

A useful evaluation should separate at least five failure classes:

1. **task failure** - the agent completed the run but failed the deterministic oracle;
2. **agent error** - the agent command returned a non-zero status;
3. **timeout** - the episode exceeded its time budget;
4. **grader error** - the oracle could not evaluate the produced state;
5. **harness error** - the runner could not execute the episode correctly.

Collapsing these into one red number hides whether the model or the measurement apparatus failed.

## Robustness control

Every task is evaluated in a clean workspace and a semantically equivalent workspace containing an irrelevant file. The included `brittle` reference agent deliberately aborts when that irrelevant file exists. The harness must expose this known failure through lower success and lower environment consistency.

This is a negative control for the evaluator itself: if the lab cannot distinguish the robust and brittle references, the metric should not be trusted.

## Regression gate

Per-task scores can be compared with a committed baseline using a seeded paired bootstrap. The gate fails when the lower bound of the 95% bootstrap interval crosses the configured regression margin. The seed, sample count, task corpus, and run count are recorded in the report.

## Scope and limitations

The committed corpus is synthetic and intentionally small. It demonstrates evaluation mechanics, not frontier-model capability. Real model conclusions require richer tasks, independent dataset design, contamination controls, larger sample sizes, and validation against external signals.
