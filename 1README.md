# StatelessPy

StatelessPy is a browser-local Python runner built on Pyodide. It executes code client-side with no backend, uses local browser storage for theme and code autosave, and lets you explicitly export files created during execution.

It is designed for environments where a modern browser is available, but native Python tooling is not.

**Live Demo:** GitHub Pages link to be finalized

## What it is

- Browser-local Python execution in a WebAssembly runtime
- No backend or server-side execution
- Local autosave for code and theme in this browser
- Explicit download of generated files such as `result.json`

## What it is not

- Not strictly stateless in the strongest sense: code and theme may persist in `localStorage`
- Not offline by default: Pyodide is loaded from jsDelivr CDN unless you self-host it
- Not intended for long-running or production workloads
- Not a multi-session workspace or synchronized environment

## How it works

- Python code runs client-side in Pyodide
- Standard output and errors are captured and shown in the page
- Files written inside the Pyodide filesystem remain transient until you download them
- Code and theme may be restored from browser storage on reload

## Current capabilities

- Run Python in the browser
- Load a script from disk
- Save the current script
- Load bundled examples
- Copy output to the clipboard
- Download `result.json` when the running code creates it
- Toggle light/dark theme

## Use cases

- Quick Python experiments without local setup
- Lightweight teaching or demonstrations
- Browser-only environments where native tooling is unavailable
- Small data or JSON generation tasks that benefit from explicit local export

## Limitations

- Performance depends on browser and device resources
- Runtime loading depends on CDN availability unless self-hosted
- Browser storage behavior depends on the current browser/profile
- Persistence is local to the current browser, not a full project workspace

## Repo contents

- `index.html` — UI shell
- `main.js` — runtime, output capture, autosave, export helpers
- `style.css` — styling

## License

MIT
