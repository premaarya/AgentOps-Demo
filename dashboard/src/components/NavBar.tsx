import React from "react";
import { useAppContext, type ViewName } from "../context/AppContext.js";

const TABS: { key: ViewName; label: string; num: number }[] = [
  { key: "design", label: "Design Canvas", num: 1 },
  { key: "build", label: "Build Console", num: 2 },
  { key: "deploy", label: "Deploy Dashboard", num: 3 },
  { key: "live", label: "Live Workflow", num: 4 },
  { key: "monitor", label: "Monitor Panel", num: 5 },
  { key: "evaluation", label: "Evaluation Lab", num: 6 },
  { key: "drift", label: "Drift Detection", num: 7 },
  { key: "feedback", label: "Feedback & Optimize", num: 8 },
];

export function NavBar() {
  const { activeView, setActiveView } = useAppContext();
  const activeIdx = TABS.findIndex((t) => t.key === activeView);

  return (
    <header>
      {/* Top bar: Logo + Stage Progress */}
      <div className="nav-bar">
        <div className="nav-logo">
          <div className="nav-logo-icon">C</div>
          Contract AgentOps
        </div>
        <div className="stage-progress">
          {TABS.map((tab, i) => (
            <div
              key={tab.key}
              className={`stage-dot${i < activeIdx ? " completed" : ""}${i === activeIdx ? " active" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`tab-item${activeView === tab.key ? " active" : ""}`}
          >
            <span className="tab-num">{tab.num}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
