import React from "react";
import { useAppContext } from "../context/AppContext.js";

export function StatusBar() {
  const { demoMode, contractCount } = useAppContext();

  return (
    <footer className="status-bar">
      <div className="status-item">
        <span className="status-dot-indicator" />
        MCP Connected
      </div>
      <div className="status-item">Mode: {demoMode}</div>
      <div className="status-item">Contracts: {contractCount}</div>
      <div className="status-item" style={{ marginLeft: "auto" }}>
        Gateway: localhost:8000
      </div>
      <div className="status-item">v1.0.0</div>
    </footer>
  );
}
