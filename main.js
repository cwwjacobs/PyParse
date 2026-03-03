// UI + Pyodide integration for StatelessPy
let pyodideReadyPromise = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });

const outputEl = document.getElementById("output");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const codeEl = document.getElementById("code");
const examplesSelect = document.getElementById("examples");
const autosaveStatus = document.getElementById("autosaveStatus");
const themeToggle = document.getElementById("themeToggle");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");

const EXAMPLES = {
  "Hello": "print('Hello, StatelessPy!')",
  "Write JSON (downloadable)": "import json\nopen('result.json','w').write(json.dumps({'ok': True}))\nprint('Wrote result.json')",
  "Loop demo": "for i in range(3):\n    print('count', i)"
};

let autosaveIntervalId = null;
let autosaveDirty = false;
let currentRunResultJsonPath = null;

function setDownloadJsonState(ready) {
  if (!downloadJsonBtn) return;
  downloadJsonBtn.disabled = !ready;
  downloadJsonBtn.title = ready
    ? 'Download result.json from the current run'
    : 'No result.json from the current run';
}

function getResultJsonPath(fs) {
  try {
    const cwd = (typeof fs.cwd === "function" && fs.cwd()) || "/";
    if (!cwd || cwd === "/") return "/result.json";
    return `${cwd.replace(/\/+$/, "")}/result.json`;
  } catch (_) {
    return "/result.json";
  }
}

async function clearGeneratedResultFile(resultPath = currentRunResultJsonPath) {
  try {
    const pyodide = await pyodideReadyPromise;
    const fs = pyodide.FS;
    const pathToClear = resultPath || getResultJsonPath(fs);
    try {
      fs.unlink(pathToClear);
    } catch (_) {
      // No prior file to clear.
    }
  } catch (_) {
    // Runtime not ready or unavailable.
  } finally {
    currentRunResultJsonPath = null;
    setDownloadJsonState(false);
  }
}

async function refreshGeneratedResultState(resultPath = currentRunResultJsonPath) {
  try {
    const pyodide = await pyodideReadyPromise;
    const fs = pyodide.FS;
    const pathToCheck = resultPath || getResultJsonPath(fs);
    try {
      const stat = fs.stat(pathToCheck);
      currentRunResultJsonPath = pathToCheck;
      setDownloadJsonState(!!stat);
    } catch (_) {
      currentRunResultJsonPath = null;
      setDownloadJsonState(false);
    }
  } catch (_) {
    currentRunResultJsonPath = null;
    setDownloadJsonState(false);
  }
}

// Initialize UI state
statusEl.textContent = "Loading StatelessPy runtime...";
outputEl.textContent = "Initializing StatelessPy runtime...";

// Populate examples dropdown
(function populateExamples(){
  const defaultOpt = document.createElement('option');
  defaultOpt.text = 'Select example...';
  defaultOpt.value = '';
  examplesSelect.add(defaultOpt);
  for (const key of Object.keys(EXAMPLES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.text = key;
    examplesSelect.add(opt);
  }
})();

// Theme
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('stateless_theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}
(function initTheme(){
  const saved = localStorage.getItem('stateless_theme') || 'dark';
  applyTheme(saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Autosave
function flashAutosave() {
  autosaveStatus.style.opacity = '0.6';
  setTimeout(() => autosaveStatus.style.opacity = '1', 200);
}

function persistCode() {
  localStorage.setItem('stateless_code', codeEl.value);
  autosaveDirty = false;
  flashAutosave();
}

function startAutosave() {
  if (autosaveIntervalId) return;
  autosaveStatus.textContent = 'Autosave: on';
  autosaveIntervalId = setInterval(() => {
    if (!autosaveDirty) return;
    persistCode();
  }, 3000);
}

function stopAutosave() {
  if (autosaveIntervalId) {
    clearInterval(autosaveIntervalId);
    autosaveIntervalId = null;
  }
  autosaveDirty = false;
  autosaveStatus.textContent = 'Autosave: off';
}

function enableAutosave() {
  startAutosave();
  autosaveDirty = true;
  autosaveStatus.textContent = 'Autosave: on';
}

(function restoreCode(){
  const saved = localStorage.getItem('stateless_code');
  if (saved) {
    codeEl.value = saved;
    startAutosave();
    autosaveStatus.textContent = 'Autosave: on';
  } else {
    autosaveStatus.textContent = 'Autosave: idle';
  }
})();

codeEl.addEventListener('input', () => {
  enableAutosave();
});

// Pyodide readiness and UI enable
pyodideReadyPromise.then(() => {
  statusEl.textContent = "StatelessPy ready";
  outputEl.textContent = "StatelessPy ready. Enter Python and press Run (Ctrl/Cmd+Enter).";
  if (runBtn) runBtn.disabled = false;
  setDownloadJsonState(false);
}).catch((err) => {
  statusEl.textContent = "Failed to load runtime";
  outputEl.textContent = "Failed to load runtime: " + err;
});

// Run code with stdout/stderr capture
async function runCode() {
  const code = codeEl.value;
  outputEl.textContent = "Running...";
  runBtn.disabled = true;
  statusEl.textContent = "Running...";
  let pyodide = await pyodideReadyPromise;
  const runResultPath = getResultJsonPath(pyodide.FS);

  try {
    await clearGeneratedResultFile(runResultPath);
    const wrapped = `import sys, traceback\nfrom io import StringIO\n_out = StringIO()\n_err = StringIO()\n_old_out, _old_err = sys.stdout, sys.stderr\nsys.stdout, sys.stderr = _out, _err\n_result = None\ntry:\n${code.split('\n').map(line => '    ' + line).join('\n')}\nexcept SystemExit as e:\n    _result = "SystemExit: " + str(e)\nexcept Exception:\n    _err.write(traceback.format_exc())\nfinally:\n    sys.stdout, sys.stderr = _old_out, _old_err\n_out_val = _out.getvalue()\n_err_val = _err.getvalue()\nif _err_val:\n    _print_out = _err_val\nelif _out_val:\n    _print_out = _out_val\nelif _result is not None:\n    _print_out = str(_result)\nelse:\n    _print_out = ''\n_print_out`;

    const result = await pyodide.runPythonAsync(wrapped);
    outputEl.textContent = (typeof result === 'string') ? result : String(result);
    await refreshGeneratedResultState(runResultPath);
  } catch (err) {
    outputEl.textContent = String(err);
    currentRunResultJsonPath = null;
    setDownloadJsonState(false);
  } finally {
    runBtn.disabled = false;
    statusEl.textContent = "StatelessPy ready";
  }
}

// Keyboard shortcut: Ctrl/Cmd+Enter runs code
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
});

// File helpers
function clearOutput() { outputEl.textContent = ""; }
function clearCode() {
  codeEl.value = "";
  localStorage.removeItem('stateless_code');
  stopAutosave();
  autosaveStatus.textContent = 'Autosave: idle';
  currentRunResultJsonPath = null;
  setDownloadJsonState(false);
  clearGeneratedResultFile();
}

function downloadScript() {
  const code = codeEl.value;
  const blob = new Blob([code], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "script.py";
  a.click();
}

function loadScript(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    codeEl.value = e.target.result;
    enableAutosave();
    persistCode();
  };
  reader.readAsText(file);
}

function loadExample(event) {
  const key = event.target.value;
  if (!key) return;
  codeEl.value = EXAMPLES[key] || '';
  enableAutosave();
  persistCode();
}

// Copy output
function copyOutput() {
  const text = outputEl.textContent || '';
  navigator.clipboard?.writeText(text).then(()=> {
    statusEl.textContent = 'Output copied';
    setTimeout(()=> statusEl.textContent = 'StatelessPy ready', 1200);
  }).catch(()=> {
    alert('Copy failed — your browser may block clipboard access.');
  });
}

// Download JSON from pyodide FS
async function downloadJSONFile(filename) {
  let pyodide = await pyodideReadyPromise;
  const fs = pyodide.FS;
  const pathToRead = currentRunResultJsonPath || filename;

  try {
    const data = fs.readFile(pathToRead, { encoding: "utf8" });
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  } catch (err) {
    currentRunResultJsonPath = null;
    setDownloadJsonState(false);
    alert("File not found for the current run: " + filename);
  }
}

// Expose a few functions for inline onclick handlers
window.runCode = runCode;
window.clearOutput = clearOutput;
window.clearCode = clearCode;
window.downloadScript = downloadScript;
window.loadScript = loadScript;
window.downloadJSONFile = downloadJSONFile;
window.loadExample = loadExample;
window.copyOutput = copyOutput;
window.toggleTheme = toggleTheme;
