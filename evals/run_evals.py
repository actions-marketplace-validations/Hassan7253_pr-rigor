#!/usr/bin/env python3
"""PR Rigor benchmark runner.

The harness treats deterministic rule findings as predictions against a labeled
corpus. It calculates precision/recall/F1, exact-set accuracy, status accuracy,
per-rule and per-slice metrics, latency summaries, and regression against a
stored baseline. It uses only the Python standard library; production PR Rigor
remains dependency-free Node.js.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import shutil
import statistics
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BENCHMARK = ROOT / "evals" / "benchmark.json"
DEFAULT_BASELINE = ROOT / "evals" / "baseline.json"
NODE_RUNNER = ROOT / "evals" / "node_runner.mjs"


class EvalError(RuntimeError):
    """Base error with a machine-readable category."""

    category = "harness_failure"


class DataError(EvalError):
    category = "data_error"


class InfrastructureError(EvalError):
    category = "infrastructure_error"


class BaselineError(EvalError):
    category = "baseline_error"


@dataclass(frozen=True)
class Counts:
    tp: int = 0
    fp: int = 0
    fn: int = 0

    def add(self, other: "Counts") -> "Counts":
        return Counts(self.tp + other.tp, self.fp + other.fp, self.fn + other.fn)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DataError(f"missing file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DataError(f"invalid JSON in {path}: {exc}") from exc


def canonical_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def validate_benchmark(doc: Any) -> list[dict[str, Any]]:
    if not isinstance(doc, dict) or doc.get("schemaVersion") != 1:
        raise DataError("benchmark must be an object with schemaVersion=1")
    cases = doc.get("cases")
    if not isinstance(cases, list) or not cases:
        raise DataError("benchmark.cases must be a non-empty array")

    seen: set[str] = set()
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            raise DataError(f"case {index} must be an object")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id.strip():
            raise DataError(f"case {index} requires a non-empty string id")
        if case_id in seen:
            raise DataError(f"duplicate case id: {case_id}")
        seen.add(case_id)
        if not isinstance(case.get("input"), dict):
            raise DataError(f"case {case_id}: input must be an object")
        expected = case.get("expected")
        if not isinstance(expected, dict):
            raise DataError(f"case {case_id}: expected must be an object")
        finding_ids = expected.get("findingIds")
        if not isinstance(finding_ids, list) or any(not isinstance(item, str) for item in finding_ids):
            raise DataError(f"case {case_id}: expected.findingIds must be an array of strings")
        if len(finding_ids) != len(set(finding_ids)):
            raise DataError(f"case {case_id}: expected.findingIds contains duplicates")
        status = expected.get("status")
        if status not in {"pass", "warn", "fail", "skipped"}:
            raise DataError(f"case {case_id}: expected.status must be pass, warn, fail, or skipped")
        tags = case.get("tags", [])
        if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
            raise DataError(f"case {case_id}: tags must be an array of strings")
        if "config" in case and not isinstance(case["config"], dict):
            raise DataError(f"case {case_id}: config must be an object")
        if "preset" in case and not isinstance(case["preset"], str):
            raise DataError(f"case {case_id}: preset must be a string")
    return cases


def safe_div(numerator: float, denominator: float, empty: float = 1.0) -> float:
    return numerator / denominator if denominator else empty


def prf(counts: Counts) -> dict[str, float | int]:
    precision = safe_div(counts.tp, counts.tp + counts.fp)
    recall = safe_div(counts.tp, counts.tp + counts.fn)
    f1 = safe_div(2 * precision * recall, precision + recall) if (precision + recall) else 0.0
    return {
        "tp": counts.tp,
        "fp": counts.fp,
        "fn": counts.fn,
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(f1, 6),
    }


def case_counts(expected: Iterable[str], actual: Iterable[str]) -> Counts:
    expected_set = set(expected)
    actual_set = set(actual)
    return Counts(
        tp=len(expected_set & actual_set),
        fp=len(actual_set - expected_set),
        fn=len(expected_set - actual_set),
    )


def percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def run_node_cases(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node = shutil.which("node")
    if not node:
        raise InfrastructureError("Node.js was not found on PATH")
    if not NODE_RUNNER.exists():
        raise InfrastructureError(f"Node eval runner is missing: {NODE_RUNNER}")

    payload = {"cases": cases}
    proc = subprocess.run(
        [node, str(NODE_RUNNER)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=ROOT,
        check=False,
    )
    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or f"exit code {proc.returncode}"
        raise InfrastructureError(f"Node eval runner failed: {detail}")
    try:
        response = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise InfrastructureError("Node eval runner returned invalid JSON") from exc
    results = response.get("results")
    if not isinstance(results, list) or len(results) != len(cases):
        raise InfrastructureError("Node eval runner returned an unexpected result count")
    failures = [item for item in results if not item.get("ok")]
    if failures:
        details = "; ".join(f"{item.get('id')}: {item.get('error')}" for item in failures[:5])
        raise EvalError(f"analyzer failed on benchmark cases: {details}")
    return results


def join_cases(cases: list[dict[str, Any]], node_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {item["id"]: item for item in node_results}
    joined: list[dict[str, Any]] = []
    for case in cases:
        actual = by_id.get(case["id"])
        if not actual:
            raise InfrastructureError(f"missing analyzer result for case {case['id']}")
        expected_ids = sorted(set(case["expected"]["findingIds"]))
        actual_ids = sorted(set(actual.get("findingIds", [])))
        counts = case_counts(expected_ids, actual_ids)
        joined.append({
            "id": case["id"],
            "description": case.get("description", ""),
            "tags": case.get("tags", []),
            "expected": {
                "findingIds": expected_ids,
                "status": case["expected"]["status"],
            },
            "actual": {
                "findingIds": actual_ids,
                "status": actual.get("status"),
                "score": actual.get("score"),
            },
            "counts": {"tp": counts.tp, "fp": counts.fp, "fn": counts.fn},
            "exactFindingSet": expected_ids == actual_ids,
            "statusCorrect": case["expected"]["status"] == actual.get("status"),
            "durationMs": float(actual.get("durationMs", 0.0)),
        })
    return joined


def summarize(cases: list[dict[str, Any]]) -> dict[str, Any]:
    total_counts = Counts()
    exact = 0
    statuses = 0
    durations: list[float] = []
    rules: dict[str, Counts] = {}
    tags: dict[str, list[dict[str, Any]]] = {}

    for item in cases:
        c = Counts(**item["counts"])
        total_counts = total_counts.add(c)
        exact += int(item["exactFindingSet"])
        statuses += int(item["statusCorrect"])
        durations.append(float(item["durationMs"]))

        expected = set(item["expected"]["findingIds"])
        actual = set(item["actual"]["findingIds"])
        for rule in expected | actual:
            current = rules.get(rule, Counts())
            delta = Counts(
                tp=int(rule in expected and rule in actual),
                fp=int(rule not in expected and rule in actual),
                fn=int(rule in expected and rule not in actual),
            )
            rules[rule] = current.add(delta)
        for tag in item.get("tags", []):
            tags.setdefault(tag, []).append(item)

    micro = prf(total_counts)
    rule_metrics = {rule: prf(counts) for rule, counts in sorted(rules.items())}

    slice_metrics: dict[str, Any] = {}
    for tag, tagged_cases in sorted(tags.items()):
        tag_counts = Counts()
        tag_exact = 0
        for item in tagged_cases:
            tag_counts = tag_counts.add(Counts(**item["counts"]))
            tag_exact += int(item["exactFindingSet"])
        metrics = prf(tag_counts)
        metrics["cases"] = len(tagged_cases)
        metrics["exactMatchRate"] = round(safe_div(tag_exact, len(tagged_cases)), 6)
        slice_metrics[tag] = metrics

    return {
        "cases": len(cases),
        "micro": micro,
        "exactMatchRate": round(safe_div(exact, len(cases)), 6),
        "statusAccuracy": round(safe_div(statuses, len(cases)), 6),
        "latencyMs": {
            "mean": round(statistics.fmean(durations), 4) if durations else 0.0,
            "p50": round(percentile(durations, 0.50), 4),
            "p95": round(percentile(durations, 0.95), 4),
            "max": round(max(durations), 4) if durations else 0.0,
        },
        "perRule": rule_metrics,
        "slices": slice_metrics,
    }


def compare_baseline(summary: dict[str, Any], baseline: dict[str, Any], benchmark_hash: str) -> dict[str, Any]:
    if baseline.get("schemaVersion") != 1:
        raise BaselineError("baseline must have schemaVersion=1")
    if baseline.get("benchmarkSha256") != benchmark_hash:
        raise BaselineError(
            "benchmark corpus changed without refreshing evals/baseline.json; "
            "review label changes and run with --write-baseline intentionally"
        )
    prior = baseline.get("metrics", {})
    tolerance = baseline.get("allowedRegression", {})
    checks = {
        "microF1": (summary["micro"]["f1"], float(prior.get("microF1", 0.0)), float(tolerance.get("microF1", 0.0))),
        "exactMatchRate": (summary["exactMatchRate"], float(prior.get("exactMatchRate", 0.0)), float(tolerance.get("exactMatchRate", 0.0))),
        "statusAccuracy": (summary["statusAccuracy"], float(prior.get("statusAccuracy", 0.0)), float(tolerance.get("statusAccuracy", 0.0))),
    }
    regressions = []
    details = {}
    for name, (current, old, allowed) in checks.items():
        floor = old - allowed
        passed = current + 1e-12 >= floor
        details[name] = {
            "current": current,
            "baseline": old,
            "allowedRegression": allowed,
            "minimum": round(floor, 6),
            "passed": passed,
        }
        if not passed:
            regressions.append(name)
    return {"passed": not regressions, "regressions": regressions, "checks": details}


def baseline_document(summary: dict[str, Any], benchmark_hash: str) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "benchmarkSha256": benchmark_hash,
        "metrics": {
            "microF1": summary["micro"]["f1"],
            "exactMatchRate": summary["exactMatchRate"],
            "statusAccuracy": summary["statusAccuracy"],
        },
        "allowedRegression": {
            "microF1": 0.005,
            "exactMatchRate": 0.005,
            "statusAccuracy": 0.005,
        },
        "note": "Refresh only after reviewing benchmark-label or intended analyzer behavior changes.",
    }


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def markdown_report(result: dict[str, Any]) -> str:
    summary = result["summary"]
    micro = summary["micro"]
    regression = result.get("regression")
    lines = [
        "# PR Rigor Evaluation Report",
        "",
        f"Benchmark cases: **{summary['cases']}**  ",
        f"Micro precision: **{format_pct(micro['precision'])}**  ",
        f"Micro recall: **{format_pct(micro['recall'])}**  ",
        f"Micro F1: **{format_pct(micro['f1'])}**  ",
        f"Exact finding-set accuracy: **{format_pct(summary['exactMatchRate'])}**  ",
        f"Status accuracy: **{format_pct(summary['statusAccuracy'])}**  ",
        f"Latency p50 / p95: **{summary['latencyMs']['p50']:.3f} ms / {summary['latencyMs']['p95']:.3f} ms**",
        "",
    ]
    if regression is not None:
        lines += [
            "## Regression gate",
            "",
            f"Result: **{'PASS' if regression['passed'] else 'FAIL'}**",
            "",
        ]
        for name, detail in regression["checks"].items():
            lines.append(
                f"- `{name}`: current {detail['current']:.4f}, baseline {detail['baseline']:.4f}, "
                f"minimum {detail['minimum']:.4f} - {'pass' if detail['passed'] else 'REGRESSION'}"
            )
        lines.append("")

    mismatches = [item for item in result["cases"] if not item["exactFindingSet"] or not item["statusCorrect"]]
    lines += ["## Mismatches", ""]
    if not mismatches:
        lines.append("No labeled-case mismatches.")
    else:
        for item in mismatches:
            lines.append(
                f"- `{item['id']}` expected findings `{item['expected']['findingIds']}` / status `{item['expected']['status']}`; "
                f"got `{item['actual']['findingIds']}` / `{item['actual']['status']}`"
            )
    lines += ["", "## Per-rule metrics", "", "| Rule | Precision | Recall | F1 | TP | FP | FN |", "|---|---:|---:|---:|---:|---:|---:|"]
    for rule, metrics in summary["perRule"].items():
        lines.append(
            f"| `{rule}` | {format_pct(metrics['precision'])} | {format_pct(metrics['recall'])} | "
            f"{format_pct(metrics['f1'])} | {metrics['tp']} | {metrics['fp']} | {metrics['fn']} |"
        )
    lines += ["", "## Slice metrics", "", "| Slice | Cases | Precision | Recall | F1 | Exact |", "|---|---:|---:|---:|---:|---:|"]
    for tag, metrics in summary["slices"].items():
        lines.append(
            f"| `{tag}` | {metrics['cases']} | {format_pct(metrics['precision'])} | {format_pct(metrics['recall'])} | "
            f"{format_pct(metrics['f1'])} | {format_pct(metrics['exactMatchRate'])} |"
        )
    lines += [
        "",
        "## Diagnostic interpretation",
        "",
        "- Finding/status mismatch: likely analyzer behavior or benchmark-label regression.",
        "- Benchmark validation failure: dataset/fixture error.",
        "- Node runner/process failure: harness or infrastructure error.",
        "- Baseline hash mismatch: corpus changed without an explicit baseline review.",
        "",
        "Latency is observational only and is not used as a CI regression gate because runner hardware varies.",
        "",
    ]
    return "\n".join(lines)


def html_report(result: dict[str, Any]) -> str:
    summary = result["summary"]
    micro = summary["micro"]
    rows = []
    for rule, metrics in summary["perRule"].items():
        rows.append(
            f"<tr><td><code>{html.escape(rule)}</code></td>"
            f"<td>{format_pct(metrics['precision'])}</td><td>{format_pct(metrics['recall'])}</td>"
            f"<td>{format_pct(metrics['f1'])}</td><td>{metrics['tp']}</td><td>{metrics['fp']}</td><td>{metrics['fn']}</td></tr>"
        )
    mismatches = [item for item in result["cases"] if not item["exactFindingSet"] or not item["statusCorrect"]]
    mismatch_html = "<p class='good'>No labeled-case mismatches.</p>" if not mismatches else "<ul>" + "".join(
        f"<li><code>{html.escape(item['id'])}</code>: expected {html.escape(str(item['expected']))}; got {html.escape(str(item['actual']))}</li>"
        for item in mismatches
    ) + "</ul>"
    bars = "".join(
        f"<div class='bar-row'><span>{html.escape(tag)}</span><div class='bar'><i style='width:{metrics['f1']*100:.2f}%'></i></div><b>{metrics['f1']*100:.1f}%</b></div>"
        for tag, metrics in summary["slices"].items()
    )
    regression = result.get("regression")
    regression_text = "not checked" if regression is None else ("PASS" if regression["passed"] else "FAIL")
    return f"""<!doctype html>
<html lang='en'>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>PR Rigor Evaluation Report</title>
<style>
:root {{ color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
body {{ max-width: 1100px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }}
.card {{ border:1px solid #8885; border-radius:14px; padding:16px; }}
.big {{ font-size:1.8rem; font-weight:800; }}
table {{ border-collapse:collapse; width:100%; }} th,td {{ border-bottom:1px solid #8884; padding:8px; text-align:right; }} th:first-child,td:first-child {{ text-align:left; }}
.bar-row {{ display:grid; grid-template-columns:180px 1fr 70px; gap:10px; align-items:center; margin:8px 0; }}
.bar {{ height:12px; background:#8883; border-radius:99px; overflow:hidden; }} .bar i {{ display:block; height:100%; background:#5b8def; }}
.good {{ color:#1b8f4d; font-weight:700; }} code {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }}
</style>
</head>
<body>
<h1>PR Rigor Evaluation Report</h1>
<p>Deterministic labeled benchmark for PR-readiness findings. Regression gate: <strong>{regression_text}</strong>.</p>
<div class='grid'>
<div class='card'><div>Cases</div><div class='big'>{summary['cases']}</div></div>
<div class='card'><div>Precision</div><div class='big'>{format_pct(micro['precision'])}</div></div>
<div class='card'><div>Recall</div><div class='big'>{format_pct(micro['recall'])}</div></div>
<div class='card'><div>F1</div><div class='big'>{format_pct(micro['f1'])}</div></div>
<div class='card'><div>Exact set</div><div class='big'>{format_pct(summary['exactMatchRate'])}</div></div>
<div class='card'><div>p95 latency</div><div class='big'>{summary['latencyMs']['p95']:.3f} ms</div></div>
</div>
<h2>Slice F1</h2>{bars}
<h2>Mismatches</h2>{mismatch_html}
<h2>Per-rule metrics</h2>
<table><thead><tr><th>Rule</th><th>Precision</th><th>Recall</th><th>F1</th><th>TP</th><th>FP</th><th>FN</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<p><small>Latency is observational and is not a CI gate. This report contains no repository source code beyond the synthetic benchmark fixtures.</small></p>
</body></html>"""


def write_reports(out_dir: Path, result: dict[str, Any], result_name: str = "results.json") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / result_name).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (out_dir / "report.md").write_text(markdown_report(result) + "\n", encoding="utf-8")
    (out_dir / "report.html").write_text(html_report(result), encoding="utf-8")


def aggregate_results(aggregate_dir: Path, benchmark_hash: str, benchmark_case_ids: set[str]) -> list[dict[str, Any]]:
    files = sorted(aggregate_dir.rglob("results.json"))
    if not files:
        raise InfrastructureError(f"no shard results.json files found under {aggregate_dir}")
    combined: dict[str, dict[str, Any]] = {}
    for path in files:
        doc = load_json(path)
        if doc.get("benchmarkSha256") != benchmark_hash:
            raise InfrastructureError(f"shard benchmark hash mismatch: {path}")
        for item in doc.get("cases", []):
            case_id = item.get("id")
            if case_id in combined:
                raise InfrastructureError(f"duplicate shard case result: {case_id}")
            combined[case_id] = item
    missing = benchmark_case_ids - set(combined)
    extra = set(combined) - benchmark_case_ids
    if missing or extra:
        raise InfrastructureError(f"incomplete shard coverage; missing={sorted(missing)} extra={sorted(extra)}")
    return [combined[case_id] for case_id in sorted(combined)]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run PR Rigor labeled evaluations")
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_BENCHMARK)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--out-dir", type=Path, default=ROOT / "evals" / "out")
    parser.add_argument("--fail-on-regression", action="store_true")
    parser.add_argument("--write-baseline", action="store_true")
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--aggregate-dir", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        benchmark = load_json(args.benchmark)
        all_cases = validate_benchmark(benchmark)
        benchmark_hash = canonical_hash(benchmark)

        if args.aggregate_dir:
            joined = aggregate_results(args.aggregate_dir, benchmark_hash, {case["id"] for case in all_cases})
            shard = None
        else:
            if args.shard_count < 1:
                raise DataError("--shard-count must be at least 1")
            if not 0 <= args.shard_index < args.shard_count:
                raise DataError("--shard-index must satisfy 0 <= index < shard-count")
            selected = [case for index, case in enumerate(all_cases) if index % args.shard_count == args.shard_index]
            if not selected:
                raise DataError("selected shard contains no cases")
            node_results = run_node_cases(selected)
            joined = join_cases(selected, node_results)
            shard = {"index": args.shard_index, "count": args.shard_count}

        summary = summarize(joined)
        regression = None
        is_full_corpus = len(joined) == len(all_cases)
        if is_full_corpus:
            if args.write_baseline:
                baseline_doc = baseline_document(summary, benchmark_hash)
                args.baseline.write_text(json.dumps(baseline_doc, indent=2) + "\n", encoding="utf-8")
            if args.baseline.exists():
                regression = compare_baseline(summary, load_json(args.baseline), benchmark_hash)

        result = {
            "schemaVersion": 1,
            "generatedAt": now_iso(),
            "benchmarkSha256": benchmark_hash,
            "benchmarkCases": len(all_cases),
            "shard": shard,
            "summary": summary,
            "regression": regression,
            "cases": joined,
        }
        write_reports(args.out_dir, result)

        print(
            f"PR Rigor evals: {summary['cases']} cases | "
            f"precision={summary['micro']['precision']:.3f} "
            f"recall={summary['micro']['recall']:.3f} "
            f"F1={summary['micro']['f1']:.3f} "
            f"exact={summary['exactMatchRate']:.3f} "
            f"status={summary['statusAccuracy']:.3f}"
        )
        if regression is not None:
            print(f"Regression gate: {'PASS' if regression['passed'] else 'FAIL'}")
        print(f"Reports: {args.out_dir}")

        if args.fail_on_regression and regression is not None and not regression["passed"]:
            print("Evaluation regression detected: " + ", ".join(regression["regressions"]), file=sys.stderr)
            return 1
        mismatched = [item for item in joined if not item["exactFindingSet"] or not item["statusCorrect"]]
        if args.fail_on_regression and regression is None and is_full_corpus and mismatched:
            print("Labeled benchmark mismatch detected", file=sys.stderr)
            return 1
        return 0
    except EvalError as exc:
        print(json.dumps({"errorType": exc.category, "message": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
