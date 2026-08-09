import json, subprocess, sys, tempfile, unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
RUN=HERE/'run_agent_evals.py'; AGENT=HERE/'fixture_agent.py'

class HarnessTests(unittest.TestCase):
    def run_profile(self, profile):
        with tempfile.TemporaryDirectory() as td:
            agent_cmd=subprocess.list2cmdline([sys.executable, str(AGENT), '--profile', profile])
            cmd=[sys.executable,str(RUN),'--agent',agent_cmd,'--repeat','2','--out',td]
            cp=subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(cp.returncode,0,cp.stderr)
            return json.loads((Path(td)/'report.json').read_text())['summary']
    def test_robust_reference_passes(self):
        s=self.run_profile('robust'); self.assertEqual(s['success_rate'],1.0); self.assertEqual(s['environment_consistency'],1.0)
    def test_brittle_control_is_exposed_by_perturbation(self):
        s=self.run_profile('brittle'); self.assertLess(s['success_rate'],1.0); self.assertLess(s['environment_consistency'],1.0); self.assertGreater(s['failures'].get('task_failure',0),0)

if __name__=='__main__': unittest.main()
