"""Static report rendering for PR Rigor Eval Lab."""

import html
import json
from pathlib import Path
from typing import Any

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


