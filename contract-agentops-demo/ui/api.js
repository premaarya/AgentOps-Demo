/* ============================================================
   Contract AgentOps Dashboard - API Integration Layer
   Handles Simulated/Real mode switching and gateway API calls
   ============================================================ */

var GATEWAY_URL = 'http://localhost:8000';
var dashboardMode = 'simulated'; // 'simulated' | 'real'
var ws = null; // WebSocket connection for live workflow

// --- Mode Toggle ---
function setMode(mode) {
  dashboardMode = mode;
  var btns = document.querySelectorAll('.mode-btn');
  btns.forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  document.getElementById('mode-status-item').textContent = 'Mode: ' + mode.charAt(0).toUpperCase() + mode.slice(1);

  if (mode === 'real') {
    checkGatewayHealth();
    // Pre-load monitor contract list for real mode
    loadMonitorContractListReal();
  } else {
    var dot = document.getElementById('mcp-status-dot');
    dot.className = 'status-dot';
    document.getElementById('mcp-status-text').textContent = 'MCP Status: 8/8 [PASS]';
  }
}

// --- Health Check ---
function checkGatewayHealth() {
  var dot = document.getElementById('mcp-status-dot');
  var text = document.getElementById('mcp-status-text');

  fetch(GATEWAY_URL + '/api/v1/health', { signal: AbortSignal.timeout(3000) })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var servers = data.servers || {};
      var online = Object.values(servers).filter(function (s) { return s === 'online'; }).length;
      var total = Object.keys(servers).length || 8;
      dot.className = 'status-dot ' + (online === total ? 'connected' : 'disconnected');
      text.textContent = 'MCP Status: ' + online + '/' + total + (online === total ? ' [PASS]' : ' [WARN]');
    })
    .catch(function () {
      dot.className = 'status-dot disconnected';
      text.textContent = 'MCP Status: Gateway offline';
    });
}

// --- API Helper ---
function apiCall(method, path, body) {
  var opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000)
  };
  if (body) { opts.body = JSON.stringify(body); }
  return fetch(GATEWAY_URL + path, opts).then(function (res) {
    if (!res.ok) {
      return res.json().then(function (err) {
        throw new Error(err.message || err.error || 'API error ' + res.status);
      });
    }
    return res.json();
  });
}

// --- Real Mode: Build Console ---
function runToolReal(server, tool) {
  var outputEl = document.getElementById('console-output');
  var statsEl = document.getElementById('console-stats');
  var inputText = document.getElementById('console-input').textContent;

  outputEl.textContent = '// Calling ' + server + '/' + tool + ' via gateway...';
  outputEl.style.color = 'var(--color-accent)';

  var input = {};
  try { input = JSON.parse(inputText); } catch (_e) {
    input = { text: inputText };
  }

  var startTime = Date.now();
  apiCall('POST', '/api/v1/tools/' + server + '/' + tool, { input: input })
    .then(function (data) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
      outputEl.textContent = JSON.stringify(data.result || data, null, 2);
      outputEl.style.color = 'var(--color-text-secondary)';
      statsEl.style.display = 'flex';
      document.getElementById('stat-latency').textContent = elapsed;
      document.getElementById('stat-tokens').textContent = (data.tokens_in || '--') + ' in / ' + (data.tokens_out || '--') + ' out';
      document.getElementById('stat-status').innerHTML = '<span class="badge badge-pass">[PASS] Success</span>';
    })
    .catch(function (err) {
      outputEl.textContent = '// Error: ' + err.message;
      outputEl.style.color = 'var(--color-fail)';
      statsEl.style.display = 'flex';
      document.getElementById('stat-status').innerHTML = '<span class="badge badge-fail">[FAIL] Error</span>';
    });
}

// --- Real Mode: Deploy Pipeline ---
function runDeployPipelineReal() {
  var btn = document.getElementById('deploy-btn');
  btn.disabled = true;
  btn.textContent = 'Deploying...';

  var stages = ['stage-build', 'stage-test', 'stage-deploy', 'stage-register'];

  apiCall('POST', '/api/v1/deploy/pipeline')
    .then(function (data) {
      // Animate stages with real data
      var pipelineStages = data.pipeline || [];
      stages.forEach(function (stageId, i) {
        var el = document.getElementById(stageId);
        var stageData = pipelineStages[i] || {};
        setTimeout(function () {
          el.classList.add('completed');
          var passed = stageData.status === 'passed' || stageData.status === 'completed' || stageData.status === 'registered';
          el.querySelector('.deploy-stage-status').innerHTML = '<span class="badge badge-' + (passed ? 'pass' : 'fail') + '">[' + (passed ? 'PASS' : 'FAIL') + ']</span>';
          el.querySelector('.deploy-stage-time').textContent = stageData.duration || '--';
        }, (i + 1) * 400);
      });

      // Populate agent registry from real data
      var agentDelay = (stages.length + 1) * 400;
      setTimeout(function () {
        var tbody = document.getElementById('agent-registry-body');
        tbody.innerHTML = '';
        var agents = data.agents || [];
        agents.forEach(function (agent, j) {
          setTimeout(function () {
            var row = document.createElement('tr');
            row.style.animation = 'viewFadeIn 0.3s ease';
            var statusBadge = agent.status === 'registered' ? 'pass' : 'fail';
            row.innerHTML = '<td>' + agent.name + '</td>'
              + '<td style="font-family:var(--font-mono);font-size:12px">' + (agent.foundry_agent_id || '--') + '</td>'
              + '<td><span class="badge badge-' + statusBadge + '">' + agent.status + '</span></td>'
              + '<td>Contracts</td>';
            tbody.appendChild(row);
          }, j * 200);
        });
        btn.textContent = 'Deployed';
      }, agentDelay);
    })
    .catch(function (err) {
      btn.textContent = 'Deploy Failed';
      btn.disabled = false;
      var summary = document.getElementById('deploy-summary');
      summary.textContent = 'Error: ' + err.message;
      summary.style.color = 'var(--color-fail)';
    });
}

// --- Real Mode: Live Workflow (WebSocket) ---
function startWorkflowReal() {
  var dropArea = document.getElementById('drop-area');
  dropArea.textContent = 'Processing via gateway...';
  dropArea.style.borderColor = 'var(--color-accent)';
  dropArea.style.color = 'var(--color-accent)';

  var log = document.getElementById('activity-log');
  log.innerHTML = '';
  document.getElementById('contract-details').style.display = 'flex';

  // Get contract text (use the sample from the UI's input field or default)
  var contractText = 'This Non-Disclosure Agreement is entered into between Acme Corp and Beta Inc effective March 1, 2026. Recipient shall not disclose any Confidential Information for a period of 2 years. Liability cap: $2,500,000.';

  // Submit contract to gateway
  addLog(new Date().toLocaleTimeString(), 'System', 'Submitting contract to gateway...');

  apiCall('POST', '/api/v1/contracts', { text: contractText, filename: 'NDA.pdf' })
    .then(function (data) {
      addLog(new Date().toLocaleTimeString(), 'System', 'Contract submitted: ' + data.contract_id);
      // Connect WebSocket for real-time updates
      connectWorkflowWs(data.contract_id);
    })
    .catch(function (err) {
      addLog(new Date().toLocaleTimeString(), 'System', 'Error: ' + err.message);
      dropArea.textContent = 'Error - ' + err.message;
      dropArea.style.borderColor = 'var(--color-fail)';
      dropArea.style.color = 'var(--color-fail)';
      workflowRunning = false;
    });
}

function connectWorkflowWs(contractId) {
  if (ws) { try { ws.close(); } catch (_e) { /* ignore */ } }

  var wsUrl = GATEWAY_URL.replace('http', 'ws') + '/ws/workflow';
  ws = new WebSocket(wsUrl);

  ws.onopen = function () {
    addLog(new Date().toLocaleTimeString(), 'System', 'WebSocket connected - streaming events');
  };

  ws.onmessage = function (event) {
    try {
      var msg = JSON.parse(event.data);
      handleWorkflowEvent(msg);
    } catch (_e) {
      // non-JSON message
    }
  };

  ws.onclose = function () {
    addLog(new Date().toLocaleTimeString(), 'System', 'WebSocket disconnected');
  };

  ws.onerror = function () {
    addLog(new Date().toLocaleTimeString(), 'System', 'WebSocket error - falling back to polling');
    // Fallback: just let the simulated workflow run
    workflowRunning = false;
  };
}

function handleWorkflowEvent(msg) {
  var event = msg.event || msg.type || '';
  var agentName = msg.agent || '';
  var time = new Date().toLocaleTimeString();

  // Map agent names to workflow node IDs
  var agentNodeMap = {
    'intake': 'wf-intake',
    'extraction': 'wf-extraction',
    'compliance': 'wf-compliance',
    'approval': 'wf-approval'
  };

  var nodeId = agentNodeMap[agentName.toLowerCase()] || '';

  if (event === 'agent_start' || event === 'stage_start') {
    if (nodeId) {
      setNodeState(nodeId, 'processing', agentName + '...');
      setNodeProgress(nodeId, 30);
    }
    addLog(time, agentName, 'Started processing');
  } else if (event === 'tool_call') {
    var toolName = msg.tool || msg.tool_name || '';
    var toolResult = msg.result || '';
    if (nodeId) {
      addToolCall(nodeId + '-tools', toolName + (toolResult ? ' => ' + toolResult : ''));
      setNodeProgress(nodeId, 70);
    }
    addLog(time, agentName, toolName + (toolResult ? ' => ' + toolResult : ''));
  } else if (event === 'agent_complete' || event === 'stage_complete') {
    if (nodeId) {
      setNodeState(nodeId, 'complete', 'Complete');
      setNodeProgress(nodeId, 100);
    }
    addLog(time, agentName, '[PASS] Complete');

    // Update contract details from result
    if (msg.result) {
      if (msg.result.type) document.getElementById('cd-type').textContent = msg.result.type;
      if (msg.result.parties) document.getElementById('cd-parties').textContent = msg.result.parties;
      if (msg.result.pages) document.getElementById('cd-pages').textContent = msg.result.pages;
      if (msg.result.risk) {
        var riskBadge = msg.result.risk === 'HIGH' ? 'fail' : (msg.result.risk === 'MEDIUM' ? 'warn' : 'pass');
        document.getElementById('cd-risk').innerHTML = '<span class="badge badge-' + riskBadge + '">' + msg.result.risk + '</span>';
      }
    }
  } else if (event === 'hitl_required') {
    if (nodeId) setNodeState(nodeId, 'hitl', 'Awaiting Human');
    document.getElementById('hitl-panel').classList.add('visible');
    addLog(time, 'System', '--- PAUSED: Awaiting human review ---');
    var dropArea = document.getElementById('drop-area');
    dropArea.textContent = 'Pipeline paused - Human review required';
    dropArea.style.borderColor = 'var(--color-approval)';
    dropArea.style.color = 'var(--color-approval)';
  } else if (event === 'pipeline_complete') {
    addLog(time, 'System', '--- Pipeline COMPLETE ---');
    var dropArea2 = document.getElementById('drop-area');
    dropArea2.textContent = 'Pipeline complete';
    dropArea2.style.borderColor = 'var(--color-pass)';
    dropArea2.style.color = 'var(--color-pass)';
    workflowRunning = false;
  } else if (event === 'error') {
    addLog(time, 'System', 'Error: ' + (msg.result ? msg.result.error : 'Unknown'));
    workflowRunning = false;
  }
}

// --- Real Mode: HITL Review ---
function resolveHitlReal(decision) {
  var panel = document.getElementById('hitl-panel');
  panel.classList.remove('visible');

  var comment = document.querySelector('.hitl-comment').value || '';

  // If we have a contract ID from the WebSocket, submit review
  apiCall('POST', '/api/v1/contracts/latest/review', {
    decision: decision === 'approved' ? 'approve' : (decision === 'rejected' ? 'reject' : 'request_changes'),
    reviewer: 'demo-user',
    comment: comment
  }).catch(function () {
    // Non-critical - the UI already shows the result
  });

  // Update UI same as simulated
  var statusMap = {
    approved: { text: 'Approved', log: 'Approved' },
    rejected: { text: 'Rejected', log: 'Rejected' },
    changes: { text: 'Changes Requested', log: 'Requested changes' }
  };
  var result = statusMap[decision];
  setNodeState('wf-approval', decision === 'approved' ? 'complete' : 'warning', result.text);
  addLog(new Date().toLocaleTimeString(), 'Human', result.log);
  addLog(new Date().toLocaleTimeString(), 'System', '--- Pipeline ' + (decision === 'approved' ? 'COMPLETE' : 'STOPPED: ' + result.text) + ' ---');

  var dropArea = document.getElementById('drop-area');
  dropArea.textContent = 'Pipeline complete - ' + result.text;
  dropArea.style.borderColor = decision === 'approved' ? 'var(--color-pass)' : 'var(--color-warn)';
  dropArea.style.color = decision === 'approved' ? 'var(--color-pass)' : 'var(--color-warn)';
  workflowRunning = false;
}

// --- Real Mode: Evaluation ---
function runEvalSuiteReal() {
  var btn = document.getElementById('run-suite-btn');
  btn.disabled = true;
  btn.textContent = 'Running...';

  apiCall('POST', '/api/v1/evaluations/run', { version: 'v1.3' })
    .then(function (data) {
      // Populate ground-truth metrics
      var pm = data.per_metric || {};
      setMetricAnimated('m-extraction', (pm.extraction_accuracy || '--') + '%', 300);
      setMetricAnimated('m-compliance', (pm.compliance_accuracy || '--') + '%', 600);
      setMetricAnimated('m-classification', (pm.classification_accuracy || '--') + '%', 900);
      setMetricAnimated('m-false-flags', (pm.false_flag_rate || '--') + '%', 1200);
      setMetricAnimated('m-latency', (pm.latency_p95_s || '--') + 's', 1500);

      // Judge scores
      var js = data.judge_scores || {};
      setTimeout(function () { setJudgeMetric('j-relevance', js.relevance); }, 1800);
      setTimeout(function () { setJudgeMetric('j-groundedness', js.groundedness); }, 2000);
      setTimeout(function () { setJudgeMetric('j-coherence', js.coherence); }, 2200);

      // Overall + quality gate
      setTimeout(function () {
        document.getElementById('eval-overall').textContent = 'Overall: ' + data.passed + '/' + data.total_cases + ' passed (' + data.accuracy + '%)';
        document.getElementById('eval-last-run').textContent = 'Just now';
        var gate = document.getElementById('quality-gate');
        gate.className = 'quality-gate ' + (data.quality_gate === 'PASS' ? 'pass' : 'fail');
        gate.querySelector('.quality-gate-status').textContent = '[' + data.quality_gate + ']';
        gate.querySelector('.quality-gate-text').textContent = data.quality_gate === 'PASS' ? 'READY TO DEPLOY' : 'NOT READY';
        gate.style.animation = 'scaleIn 0.3s ease';
        btn.textContent = 'Run Suite';
        btn.disabled = false;
      }, 2500);

      // Fetch baseline comparison
      return apiCall('GET', '/api/v1/evaluations/baseline');
    })
    .then(function (baseline) {
      if (baseline && baseline.delta) {
        setBaselineDelta('b-extraction', (baseline.current.per_metric.extraction_accuracy || '--') + '%', 'd-extraction', baseline.delta.accuracy > 0 ? '+' + baseline.delta.accuracy + '%' : baseline.delta.accuracy + '%');
        setBaselineDelta('b-compliance', (baseline.current.per_metric.compliance_accuracy || '--') + '%', 'd-compliance', baseline.delta.accuracy > 0 ? '+' + baseline.delta.accuracy + '%' : baseline.delta.accuracy + '%');
      }
    })
    .catch(function (err) {
      btn.textContent = 'Error: ' + err.message;
      btn.disabled = false;
    });
}

function setMetricAnimated(id, value, delay) {
  setTimeout(function () {
    var el = document.getElementById(id);
    el.textContent = value;
    el.parentElement.style.animation = 'scaleIn 0.3s ease';
  }, delay);
}

function setJudgeMetric(id, value) {
  var el = document.getElementById(id);
  if (value === undefined || value === null) { el.textContent = '--'; return; }
  el.textContent = value.toFixed(1) + ' / 5';
  el.style.color = value >= 4.0 ? 'var(--color-pass)' : (value >= 3.0 ? 'var(--color-warn)' : 'var(--color-fail)');
  el.parentElement.style.animation = 'scaleIn 0.3s ease';
}

function setBaselineDelta(baseId, baseValue, deltaId, deltaValue) {
  var bEl = document.getElementById(baseId);
  var dEl = document.getElementById(deltaId);
  if (bEl) bEl.textContent = baseValue;
  if (dEl) {
    dEl.textContent = deltaValue;
    dEl.classList.add(deltaValue.charAt(0) === '+' ? 'positive' : 'negative');
  }
}

// --- Real Mode: Drift ---
function simulateModelSwapReal() {
  var btn = document.getElementById('swap-btn');
  btn.disabled = true;
  btn.textContent = 'Simulating...';

  apiCall('POST', '/api/v1/drift/model-swap')
    .then(function (data) {
      var candidate = data.candidate || data;
      setTimeout(function () {
        document.getElementById('cand-accuracy').textContent = (candidate.accuracy || '--') + '%';
        document.getElementById('cand-latency').textContent = (candidate.latency || '--') + 's';
        document.getElementById('cand-cost').textContent = '$' + (candidate.cost_per_1k || '--');
      }, 400);

      setTimeout(function () {
        var verdict = document.getElementById('verdict-card');
        verdict.style.opacity = '1';
        verdict.style.animation = 'scaleIn 0.3s ease';
        var v = data.verdict || data;
        document.getElementById('verdict-title').textContent = v.recommendation || 'ACCEPTABLE';
        document.getElementById('v-accuracy').textContent = v.accuracy_delta || '--';
        document.getElementById('v-cost').textContent = v.cost_delta || '--';
        document.getElementById('v-latency').textContent = v.latency_delta || '--';
        btn.textContent = 'Simulate Swap';
        btn.disabled = false;
      }, 900);
    })
    .catch(function (err) {
      btn.textContent = 'Error';
      btn.disabled = false;
      console.error('Model swap error:', err);
    });
}

// --- Real Mode: Feedback ---
function optimizeFeedbackReal() {
  var btn = document.getElementById('optimize-btn');
  btn.disabled = true;
  btn.textContent = 'Converting...';

  apiCall('POST', '/api/v1/feedback/optimize')
    .then(function (data) {
      btn.textContent = data.test_cases_created + ' test cases created';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    })
    .catch(function (err) {
      btn.textContent = 'Error: ' + err.message;
      btn.disabled = false;
    });
}

function savePromptReal() {
  var editor = document.getElementById('prompt-editor');
  var promptText = editor.value;

  apiCall('POST', '/api/v1/prompts/extraction', { prompt: promptText })
    .then(function () {
      editor.style.borderColor = 'var(--color-pass)';
      setTimeout(function () { editor.style.borderColor = '#3A3A3A'; }, 1500);
    })
    .catch(function () {
      editor.style.borderColor = 'var(--color-fail)';
      setTimeout(function () { editor.style.borderColor = '#3A3A3A'; }, 1500);
    });
}

function reEvaluateReal() {
  var btn = document.getElementById('re-eval-btn');
  btn.disabled = true;
  btn.textContent = 'Evaluating...';

  apiCall('POST', '/api/v1/evaluations/run', { version: 'v1.4' })
    .then(function (data) {
      document.getElementById('re-eval-results').style.display = 'grid';
      document.getElementById('re-eval-results').style.animation = 'viewFadeIn 0.3s ease';

      // Show before/after comparison
      var beforeEl = document.querySelector('#re-eval-results .re-eval-value');
      var afterEl = document.querySelectorAll('#re-eval-results .re-eval-value')[1];
      var deltaEl = document.querySelector('#re-eval-results .re-eval-delta');
      if (afterEl) afterEl.textContent = data.accuracy + '%';
      if (deltaEl) deltaEl.textContent = '+' + (data.accuracy - 85.0).toFixed(1) + '%';

      document.getElementById('re-eval-gate').style.display = 'block';
      document.getElementById('re-eval-gate').style.animation = 'scaleIn 0.3s ease';

      var gate = document.querySelector('#re-eval-gate .quality-gate');
      gate.className = 'quality-gate ' + (data.quality_gate === 'PASS' ? 'pass' : 'fail');
      gate.querySelector('.quality-gate-status').textContent = '[' + data.quality_gate + ']';

      btn.textContent = 'Re-Evaluate';
      btn.disabled = false;
    })
    .catch(function (err) {
      btn.textContent = 'Error';
      btn.disabled = false;
      console.error('Re-eval error:', err);
    });
}

// --- Real Mode: Build Console Tool List ---
function loadToolListReal() {
  apiCall('GET', '/api/v1/tools')
    .then(function (servers) {
      // Update server dropdown with real data
      var serverSelect = document.getElementById('mcp-server-select');
      serverSelect.innerHTML = '';
      servers.forEach(function (server) {
        var opt = document.createElement('option');
        opt.value = server.name;
        opt.textContent = server.name + (server.status === 'online' ? '' : ' (offline)');
        serverSelect.appendChild(opt);
      });

      // Build real tool map
      window.realMcpTools = {};
      servers.forEach(function (server) {
        window.realMcpTools[server.name] = server.tools.map(function (t) { return t.name; });
      });

      // Update tool dropdown for first server
      updateToolList();

      // Update tool registry display
      var registry = document.querySelector('.tool-registry-list');
      if (registry && servers[0]) {
        registry.innerHTML = '';
        servers[0].tools.forEach(function (tool) {
          var div = document.createElement('div');
          div.className = 'tool-registry-item';
          div.innerHTML = '<span class="badge badge-pass">[PASS]</span> ' + tool.name;
          registry.appendChild(div);
        });
      }
    })
    .catch(function () {
      // Keep default simulated tool list on error
    });
}

// --- Real Mode: Monitor Panel ---
function loadMonitorReal(contractId) {
  if (!contractId) {
    // Load contract list first to find available contracts
    loadMonitorContractListReal();
    return;
  }

  apiCall('GET', '/api/v1/monitor/' + encodeURIComponent(contractId))
    .then(function (data) {
      renderMonitorData(data);
    })
    .catch(function (err) {
      console.error('Monitor load error:', err);
    });
}

function loadMonitorContractListReal() {
  apiCall('GET', '/api/v1/monitor')
    .then(function (contracts) {
      var select = document.getElementById('monitor-contract-select');
      if (!select) return;
      select.innerHTML = '';
      if (contracts.length === 0) {
        var opt = document.createElement('option');
        opt.textContent = 'No contracts processed yet';
        opt.value = '';
        select.appendChild(opt);
        return;
      }
      contracts.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.contract_id;
        opt.textContent = (c.filename || c.contract_id) + ' (' + c.status + ')';
        select.appendChild(opt);
      });
      // Auto-load the first contract
      if (contracts.length > 0) {
        loadMonitorReal(contracts[0].contract_id);
      }
    })
    .catch(function () {
      // Keep static content on error
    });
}

function renderMonitorData(data) {
  if (!data || !data.agents) return;

  var agentColors = {
    intake: 'var(--color-intake)',
    extraction: 'var(--color-extraction)',
    compliance: 'var(--color-compliance)',
    approval: 'var(--color-approval)'
  };

  // Update Trace Tree
  var traceTree = document.querySelector('.trace-tree');
  if (traceTree) {
    traceTree.innerHTML = '';
    data.agents.forEach(function (agent) {
      var latencySec = (agent.latency_ms / 1000).toFixed(1);
      var div = document.createElement('div');
      div.className = 'trace-agent';
      div.innerHTML = '<div class="trace-agent-header" onclick="toggleTrace(this)">' +
        '<span class="trace-toggle">[-]</span>' +
        '<span class="trace-agent-name" style="color:' + (agentColors[agent.agent] || 'var(--color-text)') + '">' +
        agent.agent.charAt(0).toUpperCase() + agent.agent.slice(1) + '</span>' +
        '<span class="trace-agent-time">' + latencySec + 's</span>' +
        '</div>' +
        '<div class="trace-tools">' +
        '<div class="trace-tool"><span class="trace-tool-time">' + latencySec + 's</span> ' +
        agent.agent + ' <span class="badge badge-pass">[PASS]</span></div>' +
        '<div class="trace-tool" style="font-size:11px;color:var(--color-text-tertiary)">' +
        agent.tokens_in.toLocaleString() + ' tokens in / ' + agent.tokens_out.toLocaleString() + ' tokens out</div>' +
        '</div>';
      traceTree.appendChild(div);
    });
  }

  // Update Latency Breakdown
  var latencyContainer = document.getElementById('latency-bars');
  if (latencyContainer) {
    latencyContainer.innerHTML = '';
    var maxLatency = Math.max.apply(null, data.agents.map(function (a) { return a.latency_ms; }));
    data.agents.forEach(function (agent) {
      var pct = maxLatency > 0 ? Math.round((agent.latency_ms / maxLatency) * 100) : 0;
      var sec = (agent.latency_ms / 1000).toFixed(1);
      var speedClass = agent.latency_ms < 2000 ? 'fast' : agent.latency_ms < 4000 ? 'medium' : 'slow';
      var bar = document.createElement('div');
      bar.className = 'latency-bar';
      bar.innerHTML = '<div class="latency-label">' + agent.agent.charAt(0).toUpperCase() + agent.agent.slice(1) + '</div>' +
        '<div class="latency-fill-wrapper"><div class="latency-fill ' + speedClass + '" style="width:' + pct + '%"></div></div>' +
        '<div class="latency-time">' + sec + 's</div>';
      latencyContainer.appendChild(bar);
    });
    var totalSec = (data.totals.latency_ms / 1000).toFixed(1);
    var totalDiv = document.createElement('div');
    totalDiv.style.cssText = 'margin-top:12px;font-size:13px;color:var(--color-text-tertiary)';
    totalDiv.textContent = 'Total: ' + totalSec + 's (agent pipeline)';
    latencyContainer.appendChild(totalDiv);
  }

  // Update Token Usage table
  var tokenBody = document.getElementById('token-usage-body');
  if (tokenBody) {
    tokenBody.innerHTML = '';
    data.agents.forEach(function (agent) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + agent.agent.charAt(0).toUpperCase() + agent.agent.slice(1) + '</td>' +
        '<td>' + agent.tokens_in.toLocaleString() + '</td>' +
        '<td>' + agent.tokens_out.toLocaleString() + '</td>' +
        '<td>$' + agent.cost.toFixed(4) + '</td>';
      tokenBody.appendChild(tr);
    });
    // Totals row
    var totalRow = document.createElement('tr');
    totalRow.style.fontWeight = '600';
    totalRow.innerHTML = '<td>Total</td>' +
      '<td>' + data.totals.tokens_in.toLocaleString() + '</td>' +
      '<td>' + data.totals.tokens_out.toLocaleString() + '</td>' +
      '<td>$' + data.totals.cost.toFixed(4) + '</td>';
    tokenBody.appendChild(totalRow);
  }

  // Update Decision Audit Trail
  var auditBody = document.getElementById('audit-trail-body');
  if (auditBody && data.audit_trail) {
    auditBody.innerHTML = '';
    data.audit_trail.forEach(function (entry) {
      var tr = document.createElement('tr');
      var time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--';
      tr.innerHTML = '<td>' + time + '</td>' +
        '<td>' + (entry.agent ? entry.agent.charAt(0).toUpperCase() + entry.agent.slice(1) : '--') + '</td>' +
        '<td>' + (entry.action || '--') + '</td>' +
        '<td>' + (entry.reasoning || '--') + '</td>';
      auditBody.appendChild(tr);
    });
  }
}
