import time
from typing import Dict, List, Optional, Any
from collections import defaultdict

class ExperimentRecord:
    def __init__(self, experiment_id: str, policy: str, config: Dict[str, Any]):
        self.experiment_id = experiment_id
        self.policy = policy
        self.config = config
        self.status = "RUNNING"
        self.created_at = time.strftime("%Y-%m-%d %H:%M:%S")
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.duration_seconds: float = 0.0
        self.events: List[Dict[str, Any]] = []
        self.metrics: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "policy": self.policy,
            "status": self.status,
            "created_at": self.created_at,
            "duration_seconds": round(self.duration_seconds, 3),
            "config": self.config,
            "metrics": self.metrics,
            "event_count": len(self.events)
        }

class ExperimentStorage:
    def __init__(self, max_experiments: int = 50):
        self.max_experiments = max_experiments
        self.experiments: Dict[str, ExperimentRecord] = {}
        self.order: List[str] = []

    def create_experiment(self, experiment_id: str, policy: str, config: Dict[str, Any]) -> ExperimentRecord:
        record = ExperimentRecord(experiment_id, policy, config)
        if len(self.order) >= self.max_experiments:
            oldest_id = self.order.pop(0)
            self.experiments.pop(oldest_id, None)
        self.experiments[experiment_id] = record
        self.order.append(experiment_id)
        return record

    def get_experiment(self, experiment_id: str) -> Optional[ExperimentRecord]:
        return self.experiments.get(experiment_id)

    def add_event(self, experiment_id: str, event: Dict[str, Any]):
        exp = self.experiments.get(experiment_id)
        if exp:
            exp.events.append(event)
            # Cap per-experiment events to prevent uncontrolled growth
            if len(exp.events) > 2000:
                exp.events = exp.events[-1500:]

    def complete_experiment(self, experiment_id: str, metrics: Dict[str, Any]):
        exp = self.experiments.get(experiment_id)
        if exp:
            exp.status = "COMPLETED"
            exp.end_time = time.time()
            exp.duration_seconds = exp.end_time - exp.start_time
            exp.metrics = metrics

    def list_experiments(self) -> List[Dict[str, Any]]:
        return [self.experiments[eid].to_dict() for eid in reversed(self.order) if eid in self.experiments]

    def get_comparison(self) -> Dict[str, Any]:
        by_policy = defaultdict(list)
        for eid in self.order:
            exp = self.experiments.get(eid)
            if exp and exp.metrics and exp.status == "COMPLETED":
                by_policy[exp.policy].append({
                    "experiment_id": exp.experiment_id,
                    "duration_seconds": exp.duration_seconds,
                    "avg_reader_wait_ms": exp.metrics.get("avg_reader_wait_ms", 0),
                    "avg_writer_wait_ms": exp.metrics.get("avg_writer_wait_ms", 0),
                    "max_simultaneous_readers": exp.metrics.get("max_simultaneous_readers", 0),
                    "completed_readers": exp.metrics.get("completed_readers", 0),
                    "completed_writers": exp.metrics.get("completed_writers", 0),
                    "sync_violations": exp.metrics.get("sync_violations", 0)
                })
        return dict(by_policy)

exp_storage = ExperimentStorage()
