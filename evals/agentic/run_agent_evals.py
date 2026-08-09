#!/usr/bin/env python3
"""Dependency-free agentic evaluation harness for synthetic coding environments.

Design goals:
- isolate each episode in a fresh temporary workspace
- perturb semantically irrelevant environment details
- grade with deterministic oracles
- repeat trials and report variance / confidence intervals
- compare against a committed baseline without hiding regressions
- distinguish agent failure from harness / grader failure
"""
from __future__ import annotations
import argparse, fnmatch, hashlib, html, json, math, os, random, shlex, statistics, subprocess, sys, tempfile, time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TASKSET = Path(__file__).with_name("taskset.jsonl")

@dataclass
class RunResult:
    case_id: str
    category: str
    group: str
    perturbation: str
    repeat: int
    score: float
    passed: bool
    latency_ms: int
    failure_type: str | None
    grader_results: list[dict[str, Any]]


def split_command(command: str) -> list[str]:
    """Split a trusted local command on POSIX and Windows without corrupting backslashes.

    shlex.split() defaults to POSIX semantics, where backslashes are escape
    characters. That mangles ordinary Windows paths such as C:\\Users\\... .
    On Windows we use non-POSIX tokenization and remove only surrounding
    double quotes so quoted paths with spaces still work.
    """
    if os.name != 'nt':
        return shlex.split(command)
    parts = shlex.split(command, posix=False)
    out = []
    for part in parts:
        if len(part) >= 2 and part[0] == part[-1] == '"':
            part = part[1:-1]
        out.append(part)
    return out


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows=[]
    for i,line in enumerate(path.read_text(encoding="utf-8").splitlines(),1):
        if line.strip():
            try: rows.append(json.loads(line))
            except json.JSONDecodeError as e: raise ValueError(f"{path}:{i}: {e}") from e
    return rows


def nested(data: Any, dotted: str) -> Any:
    cur=data
    for part in dotted.split('.'):
        if not isinstance(cur, dict) or part not in cur: raise KeyError(dotted)
        cur=cur[part]
    return cur


def list_files(ws: Path) -> list[str]:
    return sorted(p.relative_to(ws).as_posix() for p in ws.rglob('*') if p.is_file())


def grade(ws: Path, spec: dict[str, Any]) -> tuple[bool,str]:
    typ=spec['type']
    if typ == 'file_contains':
        p=ws/spec['path']; ok=p.is_file() and spec['value'] in p.read_text(encoding='utf-8'); return ok, f"{spec['path']} contains expected text"
    if typ == 'json_equals':
        p=ws/spec['path']
        if not p.is_file(): return False, f"missing {spec['path']}"
        try: actual=nested(json.loads(p.read_text(encoding='utf-8')), spec['json_path'])
        except Exception as e: return False, f"json lookup failed: {e}"
        return actual == spec['value'], f"{spec['path']}:{spec['json_path']} == {spec['value']!r}"
    if typ == 'forbidden_glob':
        pat=spec['pattern']; hits=[f for f in list_files(ws) if fnmatch.fnmatch(f, pat) or fnmatch.fnmatch('/'+f, pat)]
        return not hits, f"forbidden pattern {pat}; hits={hits}"
    raise ValueError(f"unsupported grader type: {typ}")


def prepare_workspace(ws: Path, task: dict[str, Any], perturbation: str) -> None:
    for rel,content in task['initial_files'].items():
        p=ws/rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(content, encoding='utf-8')
    if perturbation == 'irrelevant-file':
        p=ws/'notes'/'irrelevant.txt'; p.parent.mkdir(parents=True, exist_ok=True); p.write_text('This file is intentionally irrelevant to the task.\n', encoding='utf-8')
    elif perturbation != 'clean':
        raise ValueError(f"unknown perturbation: {perturbation}")


def run_episode(task: dict[str,Any], command: str, perturbation: str, repeat: int, timeout: int) -> RunResult:
    with tempfile.TemporaryDirectory(prefix='pr-rigor-agent-eval-') as td:
        ws=Path(td); prepare_workspace(ws, task, perturbation)
        task_path=ws/'task.json'; task_path.write_text(json.dumps(task, indent=2), encoding='utf-8')
        argv=split_command(command) + ['--task', str(task_path), '--workspace', str(ws)]
        t0=time.perf_counter()
        failure=None
        try:
            proc=subprocess.run(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout, env={**os.environ, 'PR_RIGOR_AGENT_EVAL':'1'})
            if proc.returncode != 0: failure='agent_error'
        except subprocess.TimeoutExpired:
            failure='timeout'
        except OSError:
            failure='harness_error'
        latency=int((time.perf_counter()-t0)*1000)

        results=[]
        if failure is None:
            try:
                for spec in task['graders']:
                    ok,detail=grade(ws,spec); results.append({'type':spec['type'],'ok':ok,'detail':detail})
            except Exception as e:
                failure='grader_error'; results.append({'type':'internal','ok':False,'detail':str(e)})
        passed = failure is None and all(r['ok'] for r in results)
        if failure is None and not passed: failure='task_failure'
        score = (sum(1 for r in results if r['ok'])/len(results)) if results else 0.0
        return RunResult(task['id'],task['category'],task['equivalence_group'],perturbation,repeat,score,passed,latency,failure,results)


def wilson(k:int,n:int,z:float=1.96)->tuple[float,float]:
    if n == 0: return (0.0,0.0)
    p=k/n; den=1+z*z/n; center=(p+z*z/(2*n))/den; margin=z*math.sqrt((p*(1-p)+z*z/(4*n))/n)/den
    return max(0,center-margin), min(1,center+margin)


def percentile(xs:list[float], q:float)->float:
    if not xs: return 0.0
    ys=sorted(xs); pos=(len(ys)-1)*q; lo=int(math.floor(pos)); hi=int(math.ceil(pos))
    if lo==hi: return ys[lo]
    return ys[lo]+(ys[hi]-ys[lo])*(pos-lo)


def bootstrap_delta(current:dict[str,float], baseline:dict[str,float], seed:int, samples:int=4000)->tuple[float,float,float]:
    ids=sorted(set(current)&set(baseline))
    if not ids: return 0.0,0.0,0.0
    rng=random.Random(seed); deltas=[]
    for _ in range(samples):
        draw=[rng.choice(ids) for __ in ids]
        deltas.append(statistics.mean(current[i]-baseline[i] for i in draw))
    point=statistics.mean(current[i]-baseline[i] for i in ids)
    return point, percentile(deltas,.025), percentile(deltas,.975)


def summarize(runs:list[RunResult])->dict[str,Any]:
    n=len(runs); passed=sum(r.passed for r in runs); lo,hi=wilson(passed,n)
    by_case={}
    for r in runs: by_case.setdefault(r.case_id,[]).append(r.score)
    case_scores={k:statistics.mean(v) for k,v in by_case.items()}
    by_group={}
    for r in runs: by_group.setdefault(r.group,{}).setdefault(r.perturbation,[]).append(r.score)
    ranges=[]
    for pert in by_group.values():
        means=[statistics.mean(v) for v in pert.values()]
        if means: ranges.append(max(means)-min(means))
    consistency=max(0.0,1.0-(statistics.mean(ranges) if ranges else 0.0))
    failures={}
    for r in runs:
        if r.failure_type: failures[r.failure_type]=failures.get(r.failure_type,0)+1
    categories={}
    for cat in sorted({r.category for r in runs}):
        rs=[r for r in runs if r.category==cat]; categories[cat]={'runs':len(rs),'success_rate':sum(x.passed for x in rs)/len(rs),'mean_score':statistics.mean(x.score for x in rs)}
    return {
        'runs':n,'success_rate':passed/n if n else 0.0,'success_ci95':[lo,hi],
        'mean_score':statistics.mean(r.score for r in runs) if runs else 0.0,
        'score_stdev':statistics.pstdev(r.score for r in runs) if len(runs)>1 else 0.0,
        'environment_consistency':consistency,
        'latency_ms_mean':statistics.mean(r.latency_ms for r in runs) if runs else 0.0,
        'failures':failures,'categories':categories,'case_scores':case_scores,
    }


def render_md(summary:dict[str,Any], comparison:dict[str,Any]|None)->str:
    lo,hi=summary['success_ci95']
    lines=['# Agentic Eval Lab report','', '## Measurement card','',
        f"- Runs: **{summary['runs']}**",
        f"- Success rate: **{summary['success_rate']:.1%}** (95% Wilson CI {lo:.1%}-{hi:.1%})",
        f"- Mean grader score: **{summary['mean_score']:.3f}**",
        f"- Score stdev: **{summary['score_stdev']:.3f}**",
        f"- Environment consistency: **{summary['environment_consistency']:.3f}**",
        f"- Mean episode latency: **{summary['latency_ms_mean']:.0f} ms**",'',
        'Environment consistency measures whether semantically irrelevant workspace noise changes the score. Higher is better.','',
        '## Failure taxonomy','']
    if summary['failures']:
        for k,v in sorted(summary['failures'].items()): lines.append(f'- {k}: {v}')
    else: lines.append('- none')
    lines += ['', '## Slices','', '| Slice | Runs | Success | Mean score |','|---|---:|---:|---:|']
    for k,v in summary['categories'].items(): lines.append(f"| {k} | {v['runs']} | {v['success_rate']:.1%} | {v['mean_score']:.3f} |")
    if comparison:
        lines += ['', '## Baseline comparison','', f"- Mean paired delta: **{comparison['delta']:+.4f}**", f"- Bootstrap 95% CI: **[{comparison['ci95'][0]:+.4f}, {comparison['ci95'][1]:+.4f}]**", f"- Regression margin: **-{comparison['margin']:.4f}**", f"- Gate: **{'PASS' if comparison['pass'] else 'FAIL'}**"]
    return '\n'.join(lines)+'\n'


def render_html(summary:dict[str,Any], comparison:dict[str,Any]|None)->str:
    md=render_md(summary,comparison)
    # Simple dependency-free artifact; preserve preformatted report for auditability.
    return '<!doctype html><meta charset="utf-8"><title>Agentic Eval Lab</title><style>body{font:16px system-ui;max-width:980px;margin:40px auto;padding:0 20px;color:#1f2937}pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:24px;line-height:1.45}</style><h1>Agentic Eval Lab</h1><pre>'+html.escape(md)+'</pre>'


def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument('--taskset', default=str(DEFAULT_TASKSET))
    ap.add_argument('--agent', required=True, help='Trusted local command implementing --task PATH --workspace PATH')
    ap.add_argument('--repeat', type=int, default=3)
    ap.add_argument('--timeout', type=int, default=15)
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--out', default='evals/out/agentic')
    ap.add_argument('--baseline')
    ap.add_argument('--write-baseline')
    ap.add_argument('--margin', type=float, default=0.02)
    ap.add_argument('--fail-on-regression', action='store_true')
    args=ap.parse_args()
    tasks=read_jsonl(Path(args.taskset)); runs=[]
    for task in tasks:
        for perturbation in task.get('perturbations',['clean']):
            for rep in range(args.repeat): runs.append(run_episode(task,args.agent,perturbation,rep,args.timeout))
    summary=summarize(runs)
    comparison=None
    if args.baseline:
        base=json.loads(Path(args.baseline).read_text(encoding='utf-8'))
        delta,lo,hi=bootstrap_delta(summary['case_scores'],base['case_scores'],args.seed)
        comparison={'delta':delta,'ci95':[lo,hi],'margin':args.margin,'pass':lo >= -args.margin}
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    payload={'summary':summary,'comparison':comparison,'config':{'repeat':args.repeat,'seed':args.seed,'taskset':str(args.taskset),'agent':args.agent}}
    (out/'report.json').write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (out/'report.md').write_text(render_md(summary,comparison),encoding='utf-8')
    (out/'report.html').write_text(render_html(summary,comparison),encoding='utf-8')
    if args.write_baseline: Path(args.write_baseline).write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    digest=hashlib.sha256(json.dumps(summary,sort_keys=True).encode()).hexdigest()[:12]
    print(f"Agentic Eval Lab: runs={summary['runs']} success={summary['success_rate']:.3f} score={summary['mean_score']:.3f} consistency={summary['environment_consistency']:.3f} digest={digest}")
    if comparison: print(f"Baseline delta={comparison['delta']:+.4f} CI95=[{comparison['ci95'][0]:+.4f},{comparison['ci95'][1]:+.4f}] gate={'PASS' if comparison['pass'] else 'FAIL'}")
    if args.fail_on_regression and comparison and not comparison['pass']: return 2
    return 0

if __name__=='__main__': raise SystemExit(main())
