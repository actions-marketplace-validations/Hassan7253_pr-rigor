import importlib.util
import unittest
import sys
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("run_evals.py")
spec = importlib.util.spec_from_file_location("pr_rigor_evals", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
assert spec.loader is not None
spec.loader.exec_module(module)


class EvalHarnessTests(unittest.TestCase):
    def test_case_counts(self):
        counts = module.case_counts(["a", "b"], ["b", "c"])
        self.assertEqual((counts.tp, counts.fp, counts.fn), (1, 1, 1))

    def test_prf_perfect_empty_case(self):
        metrics = module.prf(module.Counts())
        self.assertEqual(metrics["precision"], 1.0)
        self.assertEqual(metrics["recall"], 1.0)
        self.assertEqual(metrics["f1"], 1.0)

    def test_percentile_interpolates(self):
        self.assertAlmostEqual(module.percentile([1.0, 3.0], 0.5), 2.0)

    def test_benchmark_validation_rejects_duplicate_ids(self):
        doc = {
            "schemaVersion": 1,
            "cases": [
                {"id": "x", "input": {}, "expected": {"findingIds": [], "status": "pass"}},
                {"id": "x", "input": {}, "expected": {"findingIds": [], "status": "pass"}},
            ],
        }
        with self.assertRaises(module.DataError):
            module.validate_benchmark(doc)

    def test_baseline_detects_regression(self):
        summary = {
            "micro": {"f1": 0.95},
            "exactMatchRate": 0.90,
            "statusAccuracy": 1.0,
        }
        baseline = {
            "schemaVersion": 1,
            "benchmarkSha256": "abc",
            "metrics": {"microF1": 1.0, "exactMatchRate": 1.0, "statusAccuracy": 1.0},
            "allowedRegression": {"microF1": 0.01, "exactMatchRate": 0.01, "statusAccuracy": 0.01},
        }
        result = module.compare_baseline(summary, baseline, "abc")
        self.assertFalse(result["passed"])
        self.assertIn("microF1", result["regressions"])


if __name__ == "__main__":
    unittest.main()
