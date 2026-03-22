# Theophysics Paper Engine — Claude Build Guide

**Audience:** You, Claude. This document assumes you are picking up this repository to continue building the Obsidian plugin. Read it before writing any code.

**Last grounded:** 2026-03-21 against main.ts, config.json, manifest.json, paper_engine.py, templates.py

---

## 1. Your Mission

This plugin turns Obsidian markdown notes into publication-quality Word documents and PDFs styled with the Theophysics visual identity — navy headings, gold accent bars, Georgia body text, and the full 7Q scoring color system.

### What Already Works

The scaffold in `main.ts` is functional. It:

- Registers a ribbon icon and four commands: single export (Word), single export (PDF), 7Q template generation, and batch export of all formal papers (FT-\*/FP-\*/SP\*)
- Bridges to Python via `child_process.exec`: writes a temp `.md` file, calls `paper_engine.py`, cleans up
- Exposes a settings tab with Python path, engine path, output directory, auto-PDF toggle, open-after-export toggle, and three color palette hex inputs
- Persists settings through Obsidian's `loadData()`/`saveData()` (writes to `.obsidian/plugins/theophysics-paper-engine/data.json`)

### What Needs Building

The plugin is a thin bridge right now. The Python side does the heavy lifting. Your job is to make the Obsidian side smarter: richer settings UI, frontmatter integration, preview capabilities, batch progress feedback, and eventually Zenodo DOI minting. Details in the Extension Roadmap (Section 3).

### The Deliverable

Users open a note like `FP-012_Logos_Field_Dynamics.md`, hit Cmd/Ctrl+P, type "Export", and get a styled `.docx` (and optionally `.pdf`) in their exports folder — branded, scored, publication-ready. No manual formatting. No leaving Obsidian.

---

## 2. Architecture Deep Dive

### 2.1 The Pipeline

```
User triggers command
        |
        v
main.ts (Plugin)
   |
   |-- reads note content via this.app.vault.read(file)
   |-- writes temp .md to vault/.paper-engine-tmp/
   |-- constructs CLI command string
   |
   v
child_process.exec()
   |
   |-- calls: python paper_engine.py "<tmp.md>" --out "<outDir>" [--pdf]
   |
   v
paper_engine.py
   |-- strip_frontmatter() -> extract title, discard YAML
   |-- extract_title_block() -> title, subtitle, author, body
   |-- convert_md_to_docx() -> walk lines, emit styled paragraphs
   |-- export_pdf() via docx2pdf (optional)
   |
   v
Output: exports/FP-012_Logos_Field_Dynamics.docx (.pdf)
```

Why a Python bridge instead of pure JS? Because `python-docx` is mature, battle-tested, and already handles the full docx XML spec. There is no JS equivalent with comparable fidelity for styled document generation. The tradeoff is requiring Python on the user's machine, which is why `isDesktopOnly: true` exists in manifest.json.

### 2.2 Settings Flow

```
Settings UI (PluginSettingTab)
        |
        | user edits a field
        v
this.plugin.settings.fieldName = value
        |
        v
this.plugin.saveSettings()
        |
        v
this.saveData(this.settings)
        |
        v
.obsidian/plugins/theophysics-paper-engine/data.json
```

On load, `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` merges saved data over defaults. This means new settings you add to `DEFAULT_SETTINGS` automatically get their default values without migrating old data.json files — the merge handles it.

**Important distinction:** `data.json` (Obsidian-managed plugin settings) is separate from `config.json` (the Python engine's color/font/branding configuration). Right now they are not synced. The plugin stores only three palette colors in its settings; the Python engine reads `config.json` directly. This is a gap you should close — see Extension Roadmap item on config sync.

### 2.3 config.json: The Style Bible

```json
{
  "palette": {
    "header_accent": "#B8860B",    // Gold — the signature color
    "heading_primary": "#1A3C5E",  // Navy — H1, H2
    "heading_secondary": "#2C5F8A", // Blue — H3, H4
    "body_text": "#000000",
    "subtitle": "#555555",
    "metadata": "#888888",
    "blockquote": "#444444",
    "table_header_bg": "#F5E6CC",  // Warm parchment
    "table_header_text": "#1A3C5E",
    "footer": "#888888"
  },
  "fonts": { ... },
  "sizes": { ... },
  "margins": { ... },
  "branding": {
    "header_text": "THEOPHYSICS RESEARCH",
    "footer_text": "Theophysics Research  |  theophysics.pro  |  David Lowe",
    "author_default": "David Lowe | Theophysics Research | March 2026"
  },
  "cover_page": { "enabled": true, "show_logo_bar": true, "show_score_card": true },
  "7q_colors": {
    "Q0": { "name": "Arrive",        "hex": "#8A8D9B", "bg": "#E8E9EC" },
    "Q1": { "name": "Define",        "hex": "#D4A853", "bg": "#FDF5E6" },
    ...
    "Q7": { "name": "Falsification", "hex": "#EF4444", "bg": "#FEE2E2" }
  }
}
```

This is the single source of truth for all visual styling. The Python engine hardcodes its own color constants (duplicating these values), which is technical debt. Ideally, `paper_engine.py` should read `config.json` at runtime. When you extend the plugin, write palette changes back to `config.json` so the Python side picks them up.

### 2.4 Vault API Patterns in Use

The plugin currently uses four Vault API methods. Know what each one is for:

| Method | Used In | Purpose |
|--------|---------|---------|
| `this.app.vault.read(file)` | `exportFile()` | Full content read for export. Use this when you need the current file content and may modify it. |
| `this.app.vault.getMarkdownFiles()` | `batchExport()` | Returns all `.md` TFile objects in the vault. Filtered by regex for FT-/FP-/SP prefixes. |
| `this.app.vault.adapter.getBasePath()` | Multiple | Returns the vault's absolute filesystem path. Needed for child_process calls since Python operates on real paths, not vault-relative ones. |
| `this.app.workspace.getActiveFile()` | Commands | Gets the currently focused file. Returns `null` if no file is open — always guard this. |

Methods you should know but aren't used yet:

```typescript
// Cached read — faster, fine for display-only use (preview pane)
const cached = await this.app.vault.cachedRead(file);

// Atomic modify — read-modify-write with no race conditions
await this.app.vault.process(file, (data) => {
    return data + '\n<!-- exported: ' + new Date().toISOString() + ' -->';
});

// Frontmatter cache — instant access to parsed YAML without reading the file
const cache = this.app.metadataCache.getFileCache(file);
const frontmatter = cache?.frontmatter;
// frontmatter.title, frontmatter['7q_scores'], etc.
```

The `metadataCache` pattern is critical for the frontmatter-based auto-scoring feature. Obsidian already parses YAML frontmatter on every file — you never need to parse it yourself.

### 2.5 The 7Q Scoring Framework

The 7Q system evaluates papers across 8 dimensions (Q0-Q7). Each dimension has:
- A name (Arrive, Define, Locate, Commit, Support, Ground, Propagate, Falsification)
- A signature color and background color (defined in `config.json` under `7q_colors`)
- A score from 0.00 to 1.00
- An icon character for docx rendering

`templates.py` builds two template documents:
- **TEMPLATE_A_OPUS**: Dense overview strip + colored header bars per Q dimension
- **TEMPLATE_B_CLAUDE**: Colored left-border boxes, score card table, more academic layout

Both templates duplicate the `Q_COLORS` dict from config.json as Python-level constants. The `SCORES` dict is placeholder data. In a real scored paper, scores come from the AI evaluation and should be injected from frontmatter YAML:

```yaml
---
title: "Logos Field Dynamics"
7q_scores:
  Q0: 0.80
  Q1: 0.85
  Q2: 0.80
  Q3: 0.70
  Q4: 0.65
  Q5: 0.60
  Q6: 0.75
  Q7: 0.70
---
```

The plugin should read this frontmatter, pass scores to the Python engine (via CLI args or a temp JSON file), and the engine should inject them into the score card. This is the frontmatter auto-scoring feature.

---

## 3. Extension Roadmap

Prioritized by user impact and implementation complexity. Work top-down.

### P0 — Do These First

#### 3.1 Color Picker UI

**Current state:** Three hex text inputs for palette colors.
**Target:** Native `<input type="color">` pickers with live preview swatches.

The Obsidian `Setting` API does not have a built-in color picker component. You need to use `.addText()` with a custom HTML input injected into the setting control:

```typescript
new Setting(containerEl)
    .setName('Header accent')
    .setDesc('Gold accent bar color')
    .then(setting => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this.plugin.settings.palette.header_accent;
        input.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            this.plugin.settings.palette.header_accent = target.value;
            await this.plugin.saveSettings();
        });
        setting.controlEl.appendChild(input);
    });
```

Do this for all 10 palette colors in config.json, not just the three currently exposed. Group them under a collapsible section (use `containerEl.createEl('details')` with a `<summary>`).

When saving, also write the updated palette back to `config.json` so the Python engine picks up changes:

```typescript
async syncConfigJson() {
    const configPath = path.join(this.getEngineDir(), 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.palette = { ...config.palette, ...this.settings.palette };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
```

#### 3.2 Config.json Sync

**The problem:** The plugin stores 3 colors in `data.json`. The Python engine reads from hardcoded constants (not even config.json yet). Config.json exists but nothing reads it at runtime.

**The fix:**
1. Expand `PaperEngineSettings.palette` to include all 10 config.json palette keys
2. On settings save, write palette/fonts/branding back to config.json
3. On settings load, read config.json as the initial source, then overlay any saved data.json values
4. Pass `--config <path>` to paper_engine.py and update the Python side to load it

This makes config.json the authoritative style definition and the plugin settings the override mechanism.

#### 3.3 Batch Progress Modal

**Current state:** `batchExport()` fires all exports in a loop with no progress feedback. The user sees one "Batch exporting N papers..." notice and then individual completion notices that may overlap.

```typescript
class BatchProgressModal extends Modal {
    private total: number;
    private current: number = 0;
    private progressEl: HTMLElement;
    private statusEl: HTMLElement;
    private cancelled = false;

    constructor(app: App, total: number) {
        super(app);
        this.total = total;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Batch Export' });
        this.progressEl = contentEl.createEl('progress', {
            attr: { max: String(this.total), value: '0' }
        });
        this.progressEl.style.width = '100%';
        this.statusEl = contentEl.createEl('p', { text: `0 / ${this.total}` });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => { this.cancelled = true; }));
    }

    advance(filename: string) {
        this.current++;
        this.progressEl.setAttribute('value', String(this.current));
        this.statusEl.textContent = `${this.current} / ${this.total}: ${filename}`;
    }

    isCancelled(): boolean { return this.cancelled; }

    onClose() { this.contentEl.empty(); }
}
```

Update `batchExport()` to open this modal, call `advance()` after each file, and check `isCancelled()` before each iteration.

### P1 — High Value, Moderate Effort

#### 3.4 Frontmatter-Based Auto-Scoring

Read 7Q scores from YAML frontmatter and inject them into the export pipeline.

```typescript
async getScoresFromFrontmatter(file: TFile): Promise<Record<string, number> | null> {
    const cache = this.app.metadataCache.getFileCache(file);
    const scores = cache?.frontmatter?.['7q_scores'];
    if (!scores) return null;

    // Validate: must have Q0-Q7, all numeric 0-1
    const validated: Record<string, number> = {};
    for (let i = 0; i <= 7; i++) {
        const key = `Q${i}`;
        const val = parseFloat(scores[key]);
        if (isNaN(val) || val < 0 || val > 1) return null;
        validated[key] = val;
    }
    return validated;
}
```

Pass scores to the engine. Two approaches:
1. **CLI args:** `--scores Q0=0.80,Q1=0.85,...` — simple, no temp files
2. **Temp JSON:** Write a `scores.json` alongside the temp .md, engine reads it — cleaner for complex data

Option 1 is simpler. Update `paper_engine.py` to accept `--scores` and parse it in `argparse`.

#### 3.5 Cover Page Generator

`config.json` already has `cover_page.enabled`, `show_logo_bar`, and `show_score_card` flags. But `paper_engine.py` does not implement a cover page — it goes straight to the title block.

The cover page should be a full first page with:
- Gold accent bar across the top
- "THEOPHYSICS RESEARCH" header
- Large title, subtitle
- Author block
- 7Q score card (if `show_score_card` and scores exist)
- Page break before body content

Implement this in Python (`paper_engine.py`) as a `build_cover_page(doc, title, subtitle, author, scores, config)` function called before the body conversion. Add a toggle in the plugin settings.

#### 3.6 Template Selector Dropdown

Add a dropdown to settings:

```typescript
new Setting(containerEl)
    .setName('Score template style')
    .setDesc('Which 7Q template layout to use for scored exports')
    .addDropdown(dd => dd
        .addOption('opus', 'Opus — Dense overview strip')
        .addOption('claude', 'Claude — Left-border boxes')
        .addOption('minimal', 'Minimal — Score table only')
        .setValue(this.plugin.settings.templateStyle)
        .onChange(async (value) => {
            this.plugin.settings.templateStyle = value;
            await this.plugin.saveSettings();
        }));
```

Pass `--template opus|claude|minimal` to the engine. This requires refactoring `templates.py` so `build_a()` and `build_b()` can be called individually with real data instead of placeholders.

### P2 — Ambitious, High Payoff

#### 3.7 Preview Pane

Render a lightweight preview of the exported document in an Obsidian sidebar leaf. This is the hardest item on the list.

Obsidian supports custom views via `ItemView`:

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';

const VIEW_TYPE_PREVIEW = 'paper-engine-preview';

class PreviewView extends ItemView {
    getViewType() { return VIEW_TYPE_PREVIEW; }
    getDisplayText() { return 'Paper Preview'; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        // Render preview HTML here
    }
}
```

Register it in `onload()`:

```typescript
this.registerView(VIEW_TYPE_PREVIEW, (leaf) => new PreviewView(leaf));
```

For the actual preview content, you have options:
- **HTML approximation:** Convert the markdown to styled HTML using the same palette. Fast, imperfect.
- **Image render:** Export to docx, convert to images via Python (e.g., `docx2pdf` then `pdf2image`), display as `<img>`. Slow but accurate.
- **Embedded iframe:** If you generate an HTML version, render it in a sandboxed iframe.

Start with the HTML approximation. It does not need to be pixel-perfect — it needs to show the user what their color choices and heading styles look like.

#### 3.8 Zenodo Upload Integration

Zenodo has a REST API for depositing research artifacts and minting DOIs.

```typescript
interface ZenodoSettings {
    apiKey: string;      // Stored in plugin settings (sensitive — warn user)
    sandbox: boolean;    // Use sandbox.zenodo.org for testing
    communityId: string; // Optional community to submit to
}
```

The flow:
1. Export the paper to .docx/.pdf
2. Create a Zenodo deposition via `POST /api/deposit/depositions`
3. Upload the file via `PUT /api/deposit/depositions/:id/files`
4. Add metadata (title, authors, description, keywords)
5. Publish via `POST /api/deposit/depositions/:id/actions/publish`
6. Receive DOI, write it back to the note's frontmatter

Use Node.js `https` or `fetch` (available in recent Obsidian) — no need for Python here. Store the API key in settings but warn the user it is stored in plaintext in data.json.

#### 3.9 Custom CSS-to-Docx Style Mapping

Allow users to define CSS-like rules that map to docx styles:

```json
{
  "style_map": {
    "h1": { "font": "Georgia", "size": 16, "color": "#1A3C5E", "bold": true },
    "h2": { "font": "Georgia", "size": 13, "color": "#2C5F8A", "bold": true },
    "blockquote": { "font": "Georgia", "size": 11, "color": "#444444", "italic": true },
    "code": { "font": "Consolas", "size": 9, "color": "#333333" }
  }
}
```

This would live in config.json. The Python engine would read it and apply styles dynamically instead of using hardcoded `set_run()` calls with literal values. This is a refactoring task as much as a feature.

---

## 4. Design Principles

These are not suggestions. They are load-bearing constraints. Violating them creates bugs that are hard to trace in Obsidian's plugin environment.

### 4.1 Memory Management

Every event listener, interval, DOM observer, or child process you create must be cleaned up when the plugin unloads. Obsidian provides two auto-cleanup mechanisms:

```typescript
// For Obsidian events (vault, workspace, metadataCache)
this.registerEvent(
    this.app.vault.on('modify', (file) => { ... })
);

// For anything else (DOM listeners, intervals, custom cleanup)
this.register(() => {
    clearInterval(myInterval);
    myObserver.disconnect();
});
```

Both automatically fire their cleanup when the plugin is disabled or Obsidian closes. If you use `addEventListener` directly on a DOM element, wrap the removal in `this.register()`. Leaked listeners cause memory creep and ghost behavior after plugin reload.

### 4.2 Don't Block Startup

`onload()` runs during Obsidian's boot sequence. If you do heavy work here (scanning files, reading large configs, making network requests), the entire app freezes.

```typescript
async onload() {
    // FAST: register commands, ribbon, settings tab
    this.addCommand({ ... });
    this.addSettingTab(new PaperEngineSettingTab(this.app, this));

    // DEFERRED: anything that touches files or network
    this.app.workspace.onLayoutReady(async () => {
        await this.indexFormalPapers();
        await this.validatePythonPath();
    });
}
```

### 4.3 Guard Vault Events During Indexing

When Obsidian starts, it fires `create` events for every file in the vault as it indexes them. If you have a `vault.on('create')` handler that does work per file, you will process thousands of files on startup.

```typescript
this.registerEvent(
    this.app.vault.on('create', (file) => {
        if (!this.app.workspace.layoutReady) return; // Skip indexing flood
        // Handle real user-created files
    })
);
```

### 4.4 isDesktopOnly: true

This is already set in manifest.json and must stay. The plugin uses:
- `child_process.exec` (Node.js)
- `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync`, `fs.unlinkSync` (Node.js)
- `path.join` (Node.js)

None of these exist on mobile. If you ever want mobile support, you would need to rewrite the Python bridge as a remote API call or port the converter to pure JS/WASM.

### 4.5 Never Store Absolute Paths in Settings

The current code stores `outputDir` and `enginePath` as user-entered strings, which could be absolute paths. This breaks when:
- The vault is moved
- The vault is synced to another machine
- The user changes their drive letter

Prefer vault-relative paths and resolve them at runtime:

```typescript
// Store: "exports" (relative to vault root)
// Resolve: path.join(this.app.vault.adapter.getBasePath(), this.settings.outputDir)
```

The `enginePath` default already uses this pattern (resolving from the plugin directory). The user-override should document that it expects an absolute path only when the engine lives outside the vault.

### 4.6 The Python Bridge Pattern

This is the core architectural pattern. Understand it thoroughly:

```
1. READ:    content = await this.app.vault.read(file)
2. WRITE:   fs.writeFileSync(tmpPath, content)     // temp .md in vault/.paper-engine-tmp/
3. EXEC:    exec(`python paper_engine.py "${tmpPath}" --out "${outDir}"`)
4. CLEANUP: fs.unlinkSync(tmpPath); fs.rmdirSync(tmpDir)  // in exec callback
5. NOTIFY:  new Notice('Exported: filename.docx')
```

The temp directory is inside the vault (`.paper-engine-tmp/`). This is intentional — it keeps paths relative and avoids OS temp directory permission issues. The directory name starts with `.` so Obsidian ignores it.

**Current weakness:** The exec callback uses synchronous cleanup in a try/catch that silently swallows errors. If the Python script crashes mid-write, the temp file leaks. Consider adding a startup cleanup sweep:

```typescript
this.app.workspace.onLayoutReady(() => {
    const tmpDir = path.join(this.app.vault.adapter.getBasePath(), '.paper-engine-tmp');
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
```

### 4.7 Config.json as Source of Truth

`config.json` defines the complete visual language: palette (10 colors), fonts (5 families), sizes (9 levels), margins, branding strings, cover page flags, and all 8 7Q dimension colors with names and backgrounds.

Any new visual setting you add to the plugin should:
1. Have a default value in `config.json`
2. Be editable in the settings UI
3. Be written back to `config.json` on save
4. Be read by `paper_engine.py` at export time

The plugin settings (`data.json`) should store overrides and non-visual preferences (paths, toggles, API keys). Visual styling lives in `config.json`.

---

## 5. How to Test

### Console Access

`Ctrl+Shift+I` opens Obsidian's DevTools. The Console tab shows all `console.log`, `console.error`, and unhandled exceptions from plugins.

### Hot Reload

If using `npm run dev` (esbuild watch mode), saving `main.ts` rebuilds `main.js`. Then:
1. Open Obsidian Settings > Community Plugins
2. Toggle the plugin off and on

Or install the "Hot Reload" community plugin, which watches for `main.js` changes and reloads automatically.

### Error States to Test

- **No Python installed:** The exec callback should surface `stderr` ("python not found") as a Notice
- **Wrong Python path:** Same — the error message should tell the user what went wrong
- **No active file:** Every command that calls `getActiveFile()` must guard against null
- **Empty file:** `paper_engine.py` should handle files with no title block gracefully
- **Missing config.json:** If you add config.json reading, handle the file-not-found case
- **Huge batch:** Test with 20+ files. Watch for Notice spam, memory usage, and ensure the progress modal works
- **Permission errors on output dir:** The user might point to a read-only location
- **Special characters in filenames:** Spaces, parentheses, unicode — all must survive the shell command construction. The current code quotes paths but does not escape internal quotes

### Verifying the Python Bridge

```bash
# Test the engine directly from terminal
python paper_engine.py test_file.md --out ./exports --pdf

# Test template generation
python paper_engine.py --templates --out ./exports
```

If these work from the command line but not from the plugin, the issue is path resolution or Python environment differences (system Python vs. conda vs. venv).

---

## 6. What NOT to Do

### Never Use innerHTML

```typescript
// BAD — XSS risk, Obsidian will reject this in review
containerEl.innerHTML = '<div class="preview">' + userContent + '</div>';

// GOOD — use Obsidian's DOM API
const div = containerEl.createEl('div', { cls: 'preview' });
div.textContent = userContent;  // Escaped automatically
```

If you need to render HTML (e.g., for a preview), use `sanitizeHTMLToDom()` from the Obsidian API or build the DOM tree programmatically with `createEl`.

### Never Leave Event Listeners Unregistered

```typescript
// BAD — leaks on plugin reload
document.addEventListener('keydown', this.handleKey);

// GOOD — auto-cleanup
this.register(() => document.removeEventListener('keydown', this.handleKey));
```

### Never Hardcode Vault Paths

```typescript
// BAD
const outDir = 'C:/Users/lowes/Documents/exports';

// GOOD
const outDir = path.join(this.app.vault.adapter.getBasePath(), 'exports');
```

### Never Block the Main Thread with Sync Operations

```typescript
// BAD — freezes Obsidian while Python runs
const result = execSync(`python paper_engine.py ...`);

// GOOD — async with callback (current pattern)
exec(cmd, (error, stdout, stderr) => { ... });

// BETTER — promisified for async/await
import { promisify } from 'util';
const execAsync = promisify(exec);
const { stdout } = await execAsync(cmd, { timeout: 60000 });
```

The current `exportFile()` already uses async `exec`, which is correct. But `fs.writeFileSync`, `fs.existsSync`, `fs.mkdirSync` are synchronous. For small operations (writing a single temp file) this is acceptable. For anything that might touch many files or large files, use `fs.promises.*`.

### Never Save Secrets in Plain Settings Without Warning

If you add Zenodo API key support, display a warning in the settings UI:

```typescript
new Setting(containerEl)
    .setName('Zenodo API Key')
    .setDesc('WARNING: Stored in plaintext in plugin data. Do not sync this vault to public repos.')
    .addText(text => text
        .setPlaceholder('your-api-key')
        .inputEl.type = 'password');  // At least mask it visually
```

### Never Assume the Active File Exists

```typescript
// BAD
const file = this.app.workspace.getActiveFile();
await this.exportFile(file);  // Crashes if null

// GOOD
const file = this.app.workspace.getActiveFile();
if (!file) {
    new Notice('No active file to export');
    return;
}
await this.exportFile(file);
```

The current code does this correctly in the ribbon callback and the PDF command. The Word command callback does not show a notice on null — minor gap.

---

## 7. Context Files to Read First

Before starting any work on this plugin, read these files in this order. Each one gives you a different layer of understanding.

| Order | File | What It Tells You |
|-------|------|-------------------|
| 1 | `obsidian-plugin/main.ts` | The current plugin code — what exists, what patterns are used, what the settings interface looks like |
| 2 | `config.json` | The complete visual vocabulary — every color, font, size, margin, and branding string the system uses |
| 3 | `paper_engine.py` | The Python converter — how markdown is parsed, how docx is built, what CLI args it accepts |
| 4 | `templates.py` | The 7Q template generator — the Q_COLORS dict, score rendering, two template layouts |
| 5 | `obsidian-plugin/manifest.json` | Plugin identity — version, minimum Obsidian version, isDesktopOnly flag |
| 6 | `obsidian-plugin/PLUGIN_DEV_GUIDE.md` | API reference — Obsidian plugin patterns, code examples, submission checklist |
| 7 | This file (`GUIDE_CLAUDE.md`) | Architecture decisions, extension roadmap, design constraints |

### File Locations (Relative to Repo Root)

```
theophysics-paper-engine/
    config.json
    paper_engine.py
    templates.py
    obsidian-plugin/
        main.ts
        manifest.json
        PLUGIN_DEV_GUIDE.md
        GUIDE_CLAUDE.md          <-- you are here
```

---

## Appendix: Quick Reference

### Current Commands

| ID | Name | Behavior |
|----|------|----------|
| `export-current-note` | Export current note to Word | Reads active file, bridges to Python, outputs .docx |
| `export-current-note-pdf` | Export current note to PDF | Same + `--pdf` flag |
| `generate-templates` | Generate 7Q score templates | Calls engine with `--templates` flag |
| `batch-export` | Batch export all formal papers | Filters vault for FT-\*/FP-\*/SP\*, exports each |

### Current Settings

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `pythonPath` | string | `'python'` | Python executable path |
| `enginePath` | string | `''` | Path to paper_engine.py (auto-detect if empty) |
| `outputDir` | string | `''` | Export destination (vault/exports/ if empty) |
| `autoPdf` | boolean | `true` | Generate PDF alongside Word |
| `openAfterExport` | boolean | `true` | Open output folder in Explorer |
| `palette.header_accent` | string | `'#B8860B'` | Gold accent bar |
| `palette.heading_primary` | string | `'#1A3C5E'` | Navy heading color |
| `palette.heading_secondary` | string | `'#2C5F8A'` | Blue subheading color |

### The 7Q Dimensions

| Key | Name | Color | Background | Meaning |
|-----|------|-------|------------|---------|
| Q0 | Arrive | #8A8D9B | #E8E9EC | Does the paper show up to the question? |
| Q1 | Define | #D4A853 | #FDF5E6 | Are terms and scope clearly defined? |
| Q2 | Locate | #7C6340 | #F0EAE0 | Is the claim situated in existing literature? |
| Q3 | Commit | #6B8C42 | #E8F0DD | Does the author commit to a falsifiable position? |
| Q4 | Support | #38BDF8 | #E0F4FE | Is evidence cited and sufficient? |
| Q5 | Ground | #A0724A | #F0E6DA | Is the reasoning grounded in reality? |
| Q6 | Propagate | #34D399 | #DCFCE7 | Does the idea extend or predict? |
| Q7 | Falsification | #EF4444 | #FEE2E2 | Can the claim be tested and potentially disproven? |

---

*Written for Claude by Claude. Grounded in actual code, not abstractions.*
