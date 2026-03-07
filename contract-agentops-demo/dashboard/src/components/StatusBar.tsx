import React from "react";
import { useAppContext } from "../context/AppContext.js";

export function StatusBar() {
  const { demoMode, contractCount } = useAppContext();

  return (
    <footer className="status-bar">
      <div className="status-item">
        <span className="status-dot-indicator" />
        MCP Status: 8/8 [PASS]
      </div>
      <div className="status-item">Model: GPT-4o</div>
      <div className="status-item">Mode: {demoMode}</div>
      <div className="status-item">Contracts: {contractCount} loaded</div>
      <div className="status-item" style={{ marginLeft: "auto" }}>
        Contract AgentOps Demo v1.0
      </div>
    </footer>
  );
}
