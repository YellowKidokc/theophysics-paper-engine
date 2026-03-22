# GUIDE_CODEX.md — Obsidian Plugin Build Instructions for OpenAI Codex

**You are Codex. You are building an Obsidian plugin. Follow these instructions exactly.**

This repo is the **Theophysics Paper Engine** — it converts Obsidian markdown notes to styled Word/PDF documents using a Python backend (`paper_engine.py`). The Obsidian plugin (`main.ts`) is the TypeScript frontend that wires everything together inside Obsidian.

---

## 0. QUICK START CHECKLIST

### 0.1 Files to Read (in order)

| Priority | File | Relative Path | Purpose |
|----------|------|---------------|---------|
| 1 | `main.ts` | `obsidian-plugin/main.ts` | Plugin entry point — all TypeScript code lives here |
| 2 | `manifest.json` | `obsidian-plugin/manifest.json` | Plugin identity (id, version, desktop-only flag) |
| 3 | `config.json` | `config.json` | Color palette, fonts, sizes, 7Q score colors |
| 4 | `paper_engine.py` | `paper_engine.py` | Python backend — converts .md to .docx/.pdf |
| 5 | `templates.py` | `templates.py` | Generates 7Q score template Word docs |

### 0.2 What Is Already Built

**Commands (4 total, registered in `onload()` at lines 65-97):**

1. `export-current-note` — Exports active markdown note to .docx via Python
2. `export-current-note-pdf` — Same but forces PDF output
3. `generate-templates` — Calls `paper_engine.py --templates` to create 7Q template .docx files
4. `batch-export` — Finds all files matching `FT-*`, `FP-*`, `SP*` and exports each one

**Settings (6 total, defined in `PaperEngineSettings` interface at line 26):**

1. `pythonPath` (string) — Path to Python executable, default `'python'`
2. `enginePath` (string) — Path to `paper_engine.py`, default auto-detected
3. `outputDir` (string) — Output folder, default `vault/exports/`
4. `autoPdf` (boolean) — Auto-export PDF alongside Word, default `true`
5. `openAfterExport` (boolean) — Open Explorer after export, default `true`
6. `palette` (Record<string, string>) — Three color hex values: `header_accent`, `heading_primary`, `heading_secondary`

**UI Elements:**

- Ribbon icon (`file-output`) at line 55
- Settings tab (`PaperEngineSettingTab`) at lines 195-282
- Color palette inputs are plain text fields (hex strings) at lines 270-280

### 0.3 What Needs to Be Built (your task list)

| Task # | Feature | Difficulty |
|--------|---------|------------|
| 1 | Replace hex text inputs with HTML5 color pickers | Easy |
| 2 | Add cover page toggle setting | Easy |
| 3 | Add batch export progress modal with cancel button | Medium |
| 4 | Read 7Q scores from YAML frontmatter and pass to Python | Medium |
| 5 | Add template selector dropdown (opus / claude / custom) | Easy |

---

## 1. BUILD AND TEST COMMANDS

Run these in the `obsidian-plugin/` directory.

```bash
# Step 1: Install dependencies
npm install

# Step 2: Build in watch mode (rebuilds on every save)
npm run dev

# Step 3: Copy built plugin to your Obsidian vault
# Replace YOUR_VAULT with the actual vault path
cp main.js manifest.json styles.css "YOUR_VAULT/.obsidian/plugins/theophysics-paper-engine/"

# Step 4: Reload Obsidian
# In Obsidian: Ctrl+P → type "Reload app without saving" → Enter

# Step 5: Open dev console to see errors
# In Obsidian: Ctrl+Shift+I
```

If `package.json` does not exist yet, create it:

```json
{
  "name": "theophysics-paper-engine",
  "version": "0.1.0",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^16.11.6",
    "esbuild": "0.17.3",
    "obsidian": "latest",
    "tslib": "2.4.0",
    "typescript": "4.7.4"
  }
}
```

If `tsconfig.json` does not exist yet, create it:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES5", "ES6", "ES7"]
  },
  "include": ["**/*.ts"]
}
```

If `esbuild.config.mjs` does not exist yet, create it:

```javascript
import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab",
    "@codemirror/commands", "@codemirror/language", "@codemirror/lint",
    "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common",
    "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  watch: !prod,
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
}).catch(() => process.exit(1));
```

---

## 2. RULES — FOLLOW THESE AT ALL TIMES

1. **Always use `this.register()` or `this.registerEvent()`** for cleanup. Never add event listeners without registering them.
2. **Never use `innerHTML`**. Use `createEl()`, `createDiv()`, and the `Setting` API to build UI.
3. **Never store absolute paths** in settings. Use vault-relative paths or auto-detect.
4. **`isDesktopOnly: true` must stay in `manifest.json`**. The plugin uses `child_process` and `fs` from Node.js.
5. **All async operations must have try/catch** with `new Notice('Error: ...')` for user feedback.
6. **Use `cachedRead`** for display-only reads. Use `read` when you need to modify the file content.
7. **Never remove existing commands or settings** unless explicitly told to.
8. **Test every change** by reloading Obsidian (`Ctrl+P` -> "Reload app without saving") and checking `Ctrl+Shift+I` console for errors.

---

## 3. TASK 1: ADD COLOR PICKER UI

**Goal:** Replace the three hex text inputs in the Color Palette section with native color picker elements.

**Current state:** Lines 270-280 of `main.ts` use `.addText()` for color values.

**What to change:** Replace `.addText()` with `.addColorPicker()`.

### Step 1: Find the color settings loop

Open `main.ts`. Locate this exact block (lines 270-280):

```typescript
        for (const cs of colorSettings) {
            new Setting(containerEl)
                .setName(cs.name)
                .addText(text => text
                    .setPlaceholder(cs.default)
                    .setValue(this.plugin.settings.palette[cs.key] || cs.default)
                    .onChange(async (value) => {
                        this.plugin.settings.palette[cs.key] = value;
                        await this.plugin.saveSettings();
                    }));
        }
```

### Step 2: Replace with color picker

Replace that entire `for` loop with:

```typescript
        for (const cs of colorSettings) {
            new Setting(containerEl)
                .setName(cs.name)
                .addColorPicker(picker => picker
                    .setValue(this.plugin.settings.palette[cs.key] || cs.default)
                    .onChange(async (value) => {
                        this.plugin.settings.palette[cs.key] = value;
                        await this.plugin.saveSettings();
                    }));
        }
```

**What changed:** `.addText(text => text` became `.addColorPicker(picker => picker`. The `.setPlaceholder()` call was removed because color pickers do not have placeholders.

### Step 3: Verify

1. Reload Obsidian.
2. Open Settings -> Theophysics Paper Engine.
3. Scroll to "Color Palette" section.
4. Confirm three color pickers appear (not text inputs).
5. Click one. A native color chooser dialog should open.
6. Pick a color. Confirm it persists after closing and reopening Settings.

---

## 4. TASK 2: COVER PAGE TOGGLE

**Goal:** Add a boolean setting `showCoverPage` that, when enabled, passes `--cover` to `paper_engine.py`.

### Step 1: Update the interface

In `main.ts`, find the `PaperEngineSettings` interface (line 26). Add `showCoverPage`:

```typescript
interface PaperEngineSettings {
    pythonPath: string;
    enginePath: string;
    outputDir: string;
    autoPdf: boolean;
    openAfterExport: boolean;
    showCoverPage: boolean;
    palette: Record<string, string>;
}
```

### Step 2: Update DEFAULT_SETTINGS

Find `DEFAULT_SETTINGS` (line 35). Add the default value:

```typescript
const DEFAULT_SETTINGS: PaperEngineSettings = {
    pythonPath: 'python',
    enginePath: '',
    outputDir: '',
    autoPdf: true,
    openAfterExport: true,
    showCoverPage: true,
    palette: {
        header_accent: '#B8860B',
        heading_primary: '#1A3C5E',
        heading_secondary: '#2C5F8A',
    }
};
```

### Step 3: Add toggle to settings tab

In the `display()` method of `PaperEngineSettingTab`, add this new Setting block AFTER the "Open folder after export" toggle (after line 259) and BEFORE the "Color Palette" heading (before line 262):

```typescript
        new Setting(containerEl)
            .setName('Cover page')
            .setDesc('Include a branded cover page with title, author, and score card')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCoverPage)
                .onChange(async (value) => {
                    this.plugin.settings.showCoverPage = value;
                    await this.plugin.saveSettings();
                }));
```

### Step 4: Pass --cover flag to Python

In the `exportFile()` method, find line 116-118 where the command string is built:

```typescript
        const pdfFlag = (this.settings.autoPdf || forcePdf) ? '--pdf' : '';
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag}`;
```

Replace with:

```typescript
        const pdfFlag = (this.settings.autoPdf || forcePdf) ? '--pdf' : '';
        const coverFlag = this.settings.showCoverPage ? '--cover' : '';
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag} ${coverFlag}`;
```

### Step 5: Verify

1. Reload Obsidian.
2. Open Settings -> Theophysics Paper Engine.
3. Confirm "Cover page" toggle appears between "Open folder after export" and "Color Palette".
4. Toggle it on. Export a note. Check the Python console output for `--cover` in the command.
5. Toggle it off. Export again. Confirm `--cover` is absent.

**Note:** `paper_engine.py` does not yet handle `--cover`. You (or the next agent) will need to add `parser.add_argument('--cover', action='store_true')` to the Python CLI and implement cover page generation. The TypeScript side just passes the flag.

---

## 5. TASK 3: BATCH EXPORT PROGRESS MODAL

**Goal:** When batch-exporting, show a modal with a progress bar, file count, and cancel button.

### Step 1: Add the BatchExportModal class

Add this class AFTER the `PaperEngineSettingTab` class (after line 282, before the end of the file):

```typescript
class BatchExportModal extends Modal {
    private current = 0;
    private total = 0;
    private cancelled = false;
    private progressBarEl: HTMLElement;
    private statusEl: HTMLElement;
    private fileNameEl: HTMLElement;

    constructor(app: App, total: number) {
        super(app);
        this.total = total;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Batch Export' });

        this.statusEl = contentEl.createEl('p', {
            text: `Exporting 0 / ${this.total} papers...`
        });

        this.fileNameEl = contentEl.createEl('p', {
            text: '',
            cls: 'paper-engine-current-file'
        });
        this.fileNameEl.style.fontSize = '0.85em';
        this.fileNameEl.style.color = 'var(--text-muted)';

        const progressContainer = contentEl.createDiv();
        progressContainer.style.width = '100%';
        progressContainer.style.height = '20px';
        progressContainer.style.backgroundColor = 'var(--background-modifier-border)';
        progressContainer.style.borderRadius = '4px';
        progressContainer.style.overflow = 'hidden';
        progressContainer.style.marginTop = '8px';
        progressContainer.style.marginBottom = '16px';

        this.progressBarEl = progressContainer.createDiv();
        this.progressBarEl.style.height = '100%';
        this.progressBarEl.style.width = '0%';
        this.progressBarEl.style.backgroundColor = '#B8860B';
        this.progressBarEl.style.borderRadius = '4px';
        this.progressBarEl.style.transition = 'width 0.3s ease';

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .setWarning()
                .onClick(() => {
                    this.cancelled = true;
                    this.statusEl.setText('Cancelling...');
                }));
    }

    updateProgress(current: number, fileName: string) {
        this.current = current;
        const pct = Math.round((current / this.total) * 100);
        this.progressBarEl.style.width = `${pct}%`;
        this.statusEl.setText(`Exporting ${current} / ${this.total} papers...`);
        this.fileNameEl.setText(fileName);
    }

    isCancelled(): boolean {
        return this.cancelled;
    }

    complete() {
        this.statusEl.setText(`Done. ${this.current} / ${this.total} papers exported.`);
        this.progressBarEl.style.width = '100%';
        this.progressBarEl.style.backgroundColor = '#6B8C42';
        this.fileNameEl.setText('');
    }

    onClose() {
        this.contentEl.empty();
    }
}
```

### Step 2: Rewrite the batchExport() method

Find the `batchExport()` method in `PaperEnginePlugin` (lines 161-174). Replace it entirely with:

```typescript
    async batchExport() {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => /^(FT-|FP-|SP)\d+/.test(f.basename));

        if (files.length === 0) {
            new Notice('No formal papers found (FT-*, FP-*, SP*)');
            return;
        }

        const modal = new BatchExportModal(this.app, files.length);
        modal.open();

        for (let i = 0; i < files.length; i++) {
            if (modal.isCancelled()) {
                new Notice(`Batch export cancelled at ${i} / ${files.length}`);
                modal.close();
                return;
            }

            modal.updateProgress(i + 1, files[i].basename);

            try {
                await this.exportFile(files[i]);
            } catch (e) {
                console.error(`Failed to export ${files[i].basename}:`, e);
            }

            // Small delay to let the UI update
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        modal.complete();
        new Notice(`Batch export complete: ${files.length} papers`);

        // Auto-close modal after 2 seconds
        setTimeout(() => modal.close(), 2000);
    }
```

### Step 3: Make exportFile return a Promise

The current `exportFile()` method uses a callback-style `exec()`. For batch export to await each file properly, wrap the exec call in a Promise. Replace lines 122-141 (the `exec` call and everything after it in `exportFile`) with:

```typescript
        return new Promise<void>((resolve, reject) => {
            exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                // Clean up temp file
                try { fs.unlinkSync(tmpMd); } catch {}
                try { fs.rmdirSync(tmpDir); } catch {}

                if (error) {
                    new Notice(`Export failed: ${stderr || error.message}`);
                    console.error('Paper Engine error:', error);
                    resolve(); // Resolve anyway to continue batch
                    return;
                }

                new Notice(`Exported: ${file.basename}.docx`);
                console.log('Paper Engine:', stdout);

                if (this.settings.openAfterExport) {
                    exec(`explorer "${outDir.replace(/\//g, '\\\\')}"`);
                }
                resolve();
            });
        });
```

### Step 4: Verify

1. Reload Obsidian.
2. Put at least 2 files named `FP-001.md` and `FP-002.md` in the vault.
3. Run command: `Ctrl+P` -> "Batch export all formal papers".
4. Confirm the modal opens with a progress bar.
5. Confirm the progress bar fills as each file completes.
6. Confirm the file name updates for each file.
7. Test the Cancel button by running a large batch and clicking Cancel mid-way.

---

## 6. TASK 4: FRONTMATTER 7Q SCORE READER

**Goal:** Read `7q_scores` from the active file's YAML frontmatter and pass them to `paper_engine.py` as a `--scores` JSON argument.

### Expected frontmatter format in the markdown file:

```yaml
---
title: "FP-001 — The Logos Field Hypothesis"
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

### Step 1: Add a helper method to read frontmatter scores

Add this method to the `PaperEnginePlugin` class (after `getEnginePath()`, around line 184):

```typescript
    getScoresFromFrontmatter(file: TFile): Record<string, number> | null {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) return null;

        const scores = cache.frontmatter['7q_scores'];
        if (!scores || typeof scores !== 'object') return null;

        // Validate: must have Q0-Q7 keys with numeric values
        const result: Record<string, number> = {};
        for (let i = 0; i <= 7; i++) {
            const key = `Q${i}`;
            if (typeof scores[key] === 'number') {
                result[key] = scores[key];
            }
        }

        // Only return if we got at least one score
        return Object.keys(result).length > 0 ? result : null;
    }
```

### Step 2: Pass scores to Python in exportFile()

In the `exportFile()` method, find where the command string is built. After the `coverFlag` line (added in Task 2), add the scores flag:

```typescript
        const pdfFlag = (this.settings.autoPdf || forcePdf) ? '--pdf' : '';
        const coverFlag = this.settings.showCoverPage ? '--cover' : '';
        const scores = this.getScoresFromFrontmatter(file);
        const scoresFlag = scores ? `--scores '${JSON.stringify(scores)}'` : '';
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag} ${coverFlag} ${scoresFlag}`;
```

### Step 3: Handle Windows shell quoting

On Windows, single quotes in commands can cause issues. Replace the `scoresFlag` line above with:

```typescript
        const scoresFlag = scores ? `--scores "${JSON.stringify(scores).replace(/"/g, '\\"')}"` : '';
```

### Step 4: Verify

1. Create a test file `FP-099.md` in your vault with this content:
   ```
   ---
   title: "Test Paper"
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
   # Test Paper
   Body text here.
   ```
2. Open the file in Obsidian.
3. Run "Export current note to Word".
4. Check `Ctrl+Shift+I` console for the command that was executed.
5. Confirm `--scores` appears with the JSON payload.

**Note:** `paper_engine.py` does not yet handle `--scores`. Add `parser.add_argument('--scores', type=str, default=None)` and `json.loads(args.scores)` in the Python CLI to consume this data.

---

## 7. TASK 5: TEMPLATE SELECTOR DROPDOWN

**Goal:** Add a setting to choose which template style to use: `opus`, `claude`, or `custom`. Pass it to `paper_engine.py` via `--template`.

### Step 1: Update the interface

Add `templateStyle` to `PaperEngineSettings`:

```typescript
interface PaperEngineSettings {
    pythonPath: string;
    enginePath: string;
    outputDir: string;
    autoPdf: boolean;
    openAfterExport: boolean;
    showCoverPage: boolean;
    templateStyle: string;
    palette: Record<string, string>;
}
```

### Step 2: Update DEFAULT_SETTINGS

```typescript
const DEFAULT_SETTINGS: PaperEngineSettings = {
    pythonPath: 'python',
    enginePath: '',
    outputDir: '',
    autoPdf: true,
    openAfterExport: true,
    showCoverPage: true,
    templateStyle: 'opus',
    palette: {
        header_accent: '#B8860B',
        heading_primary: '#1A3C5E',
        heading_secondary: '#2C5F8A',
    }
};
```

### Step 3: Add dropdown to settings tab

In `PaperEngineSettingTab.display()`, add this AFTER the cover page toggle (from Task 2) and BEFORE the "Color Palette" heading:

```typescript
        new Setting(containerEl)
            .setName('Template style')
            .setDesc('Which document template to use for exports')
            .addDropdown(dd => dd
                .addOption('opus', 'Opus (navy headers, gold accents)')
                .addOption('claude', 'Claude (colored left-border boxes)')
                .addOption('custom', 'Custom (uses palette overrides below)')
                .setValue(this.plugin.settings.templateStyle)
                .onChange(async (value) => {
                    this.plugin.settings.templateStyle = value;
                    await this.plugin.saveSettings();
                }));
```

### Step 4: Pass --template flag to Python

In `exportFile()`, where the command string is built, add the template flag:

```typescript
        const pdfFlag = (this.settings.autoPdf || forcePdf) ? '--pdf' : '';
        const coverFlag = this.settings.showCoverPage ? '--cover' : '';
        const scores = this.getScoresFromFrontmatter(file);
        const scoresFlag = scores ? `--scores "${JSON.stringify(scores).replace(/"/g, '\\"')}"` : '';
        const templateFlag = `--template ${this.settings.templateStyle}`;
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag} ${coverFlag} ${scoresFlag} ${templateFlag}`;
```

### Step 5: Also pass it in generateTemplates()

Find `generateTemplates()` (line 143). Update the command:

```typescript
    async generateTemplates() {
        const outDir = this.settings.outputDir ||
                       path.join(this.app.vault.adapter.getBasePath(), 'exports');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const enginePath = this.getEnginePath();
        const templateFlag = `--template ${this.settings.templateStyle}`;
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" --templates --out "${outDir}" ${templateFlag}`;

        new Notice('Generating 7Q templates...');
        exec(cmd, (error, stdout) => {
            if (error) {
                new Notice('Template generation failed');
                return;
            }
            new Notice('Templates created in exports folder');
        });
    }
```

### Step 6: Verify

1. Reload Obsidian.
2. Open Settings -> Theophysics Paper Engine.
3. Confirm the "Template style" dropdown appears with three options.
4. Select "Claude". Export a note. Check console for `--template claude` in the command.
5. Select "Opus". Export. Confirm `--template opus`.

---

## 8. COMPLETE main.ts AFTER ALL TASKS

For reference, here is the final state of `main.ts` after completing all 5 tasks. If you are confused, compare your work against this.

```typescript
/**
 * Theophysics Paper Engine — Obsidian Plugin
 *
 * Exports the current note (or selected notes) to styled Word/PDF
 * using the Theophysics color palette via the Python paper_engine.
 *
 * Architecture:
 *   1. Plugin registers commands + ribbon icon
 *   2. On export, writes current note to temp .md file
 *   3. Calls paper_engine.py via child_process
 *   4. Opens output folder or copies to vault
 *
 * Settings:
 *   - Python path (auto-detected)
 *   - Output directory
 *   - Auto-PDF toggle
 *   - Color palette overrides (loads from config.json)
 *   - Cover page toggle
 *   - Template style selector
 */

import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, Modal } from 'obsidian';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface PaperEngineSettings {
    pythonPath: string;
    enginePath: string;
    outputDir: string;
    autoPdf: boolean;
    openAfterExport: boolean;
    showCoverPage: boolean;
    templateStyle: string;
    palette: Record<string, string>;
}

const DEFAULT_SETTINGS: PaperEngineSettings = {
    pythonPath: 'python',
    enginePath: '',
    outputDir: '',
    autoPdf: true,
    openAfterExport: true,
    showCoverPage: true,
    templateStyle: 'opus',
    palette: {
        header_accent: '#B8860B',
        heading_primary: '#1A3C5E',
        heading_secondary: '#2C5F8A',
    }
};

export default class PaperEnginePlugin extends Plugin {
    settings: PaperEngineSettings;

    async onload() {
        await this.loadSettings();

        // Ribbon icon
        this.addRibbonIcon('file-output', 'Export to Word/PDF', async () => {
            const file = this.app.workspace.getActiveFile();
            if (!file) {
                new Notice('No active file to export');
                return;
            }
            await this.exportFile(file);
        });

        // Commands
        this.addCommand({
            id: 'export-current-note',
            name: 'Export current note to Word',
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (file) await this.exportFile(file);
            }
        });

        this.addCommand({
            id: 'export-current-note-pdf',
            name: 'Export current note to PDF',
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (file) await this.exportFile(file, true);
            }
        });

        this.addCommand({
            id: 'generate-templates',
            name: 'Generate 7Q score templates',
            callback: async () => {
                await this.generateTemplates();
            }
        });

        this.addCommand({
            id: 'batch-export',
            name: 'Batch export all formal papers',
            callback: async () => {
                await this.batchExport();
            }
        });

        // Settings tab
        this.addSettingTab(new PaperEngineSettingTab(this.app, this));
    }

    async exportFile(file: TFile, forcePdf = false) {
        const content = await this.app.vault.read(file);
        const tmpDir = path.join(this.app.vault.adapter.getBasePath(), '.paper-engine-tmp');

        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const tmpMd = path.join(tmpDir, file.basename + '.md');
        fs.writeFileSync(tmpMd, content, 'utf-8');

        const outDir = this.settings.outputDir ||
                       path.join(this.app.vault.adapter.getBasePath(), 'exports');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const pdfFlag = (this.settings.autoPdf || forcePdf) ? '--pdf' : '';
        const coverFlag = this.settings.showCoverPage ? '--cover' : '';
        const scores = this.getScoresFromFrontmatter(file);
        const scoresFlag = scores ? `--scores "${JSON.stringify(scores).replace(/"/g, '\\"')}"` : '';
        const templateFlag = `--template ${this.settings.templateStyle}`;
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag} ${coverFlag} ${scoresFlag} ${templateFlag}`;

        new Notice(`Exporting ${file.basename}...`);

        return new Promise<void>((resolve, reject) => {
            exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                // Clean up temp file
                try { fs.unlinkSync(tmpMd); } catch {}
                try { fs.rmdirSync(tmpDir); } catch {}

                if (error) {
                    new Notice(`Export failed: ${stderr || error.message}`);
                    console.error('Paper Engine error:', error);
                    resolve();
                    return;
                }

                new Notice(`Exported: ${file.basename}.docx`);
                console.log('Paper Engine:', stdout);

                if (this.settings.openAfterExport) {
                    exec(`explorer "${outDir.replace(/\//g, '\\\\')}"`);
                }
                resolve();
            });
        });
    }

    async generateTemplates() {
        const outDir = this.settings.outputDir ||
                       path.join(this.app.vault.adapter.getBasePath(), 'exports');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const enginePath = this.getEnginePath();
        const templateFlag = `--template ${this.settings.templateStyle}`;
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" --templates --out "${outDir}" ${templateFlag}`;

        new Notice('Generating 7Q templates...');
        exec(cmd, (error, stdout) => {
            if (error) {
                new Notice('Template generation failed');
                return;
            }
            new Notice('Templates created in exports folder');
        });
    }

    async batchExport() {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => /^(FT-|FP-|SP)\d+/.test(f.basename));

        if (files.length === 0) {
            new Notice('No formal papers found (FT-*, FP-*, SP*)');
            return;
        }

        const modal = new BatchExportModal(this.app, files.length);
        modal.open();

        for (let i = 0; i < files.length; i++) {
            if (modal.isCancelled()) {
                new Notice(`Batch export cancelled at ${i} / ${files.length}`);
                modal.close();
                return;
            }

            modal.updateProgress(i + 1, files[i].basename);

            try {
                await this.exportFile(files[i]);
            } catch (e) {
                console.error(`Failed to export ${files[i].basename}:`, e);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        modal.complete();
        new Notice(`Batch export complete: ${files.length} papers`);
        setTimeout(() => modal.close(), 2000);
    }

    getEnginePath(): string {
        if (this.settings.enginePath) return this.settings.enginePath;
        const pluginDir = path.join(
            this.app.vault.adapter.getBasePath(),
            '.obsidian', 'plugins', 'theophysics-paper-engine'
        );
        return path.join(pluginDir, 'paper_engine.py');
    }

    getScoresFromFrontmatter(file: TFile): Record<string, number> | null {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) return null;

        const scores = cache.frontmatter['7q_scores'];
        if (!scores || typeof scores !== 'object') return null;

        const result: Record<string, number> = {};
        for (let i = 0; i <= 7; i++) {
            const key = `Q${i}`;
            if (typeof scores[key] === 'number') {
                result[key] = scores[key];
            }
        }

        return Object.keys(result).length > 0 ? result : null;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class PaperEngineSettingTab extends PluginSettingTab {
    plugin: PaperEnginePlugin;

    constructor(app: App, plugin: PaperEnginePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Theophysics Paper Engine' });

        new Setting(containerEl)
            .setName('Python path')
            .setDesc('Path to Python executable (usually "python" or "python3")')
            .addText(text => text
                .setPlaceholder('python')
                .setValue(this.plugin.settings.pythonPath)
                .onChange(async (value) => {
                    this.plugin.settings.pythonPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Engine script path')
            .setDesc('Path to paper_engine.py (leave blank for auto-detect)')
            .addText(text => text
                .setPlaceholder('Auto-detect')
                .setValue(this.plugin.settings.enginePath)
                .onChange(async (value) => {
                    this.plugin.settings.enginePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Output directory')
            .setDesc('Where to save exported files (leave blank for vault/exports/)')
            .addText(text => text
                .setPlaceholder('vault/exports/')
                .setValue(this.plugin.settings.outputDir)
                .onChange(async (value) => {
                    this.plugin.settings.outputDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto PDF')
            .setDesc('Automatically export PDF alongside Word document')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoPdf)
                .onChange(async (value) => {
                    this.plugin.settings.autoPdf = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Open folder after export')
            .setDesc('Open the output folder in Explorer after export')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openAfterExport)
                .onChange(async (value) => {
                    this.plugin.settings.openAfterExport = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Cover page')
            .setDesc('Include a branded cover page with title, author, and score card')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCoverPage)
                .onChange(async (value) => {
                    this.plugin.settings.showCoverPage = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Template style')
            .setDesc('Which document template to use for exports')
            .addDropdown(dd => dd
                .addOption('opus', 'Opus (navy headers, gold accents)')
                .addOption('claude', 'Claude (colored left-border boxes)')
                .addOption('custom', 'Custom (uses palette overrides below)')
                .setValue(this.plugin.settings.templateStyle)
                .onChange(async (value) => {
                    this.plugin.settings.templateStyle = value;
                    await this.plugin.saveSettings();
                }));

        // Color palette section
        containerEl.createEl('h3', { text: 'Color Palette' });

        const colorSettings = [
            { key: 'header_accent', name: 'Header accent (gold bar)', default: '#B8860B' },
            { key: 'heading_primary', name: 'Primary headings (navy)', default: '#1A3C5E' },
            { key: 'heading_secondary', name: 'Secondary headings (blue)', default: '#2C5F8A' },
        ];

        for (const cs of colorSettings) {
            new Setting(containerEl)
                .setName(cs.name)
                .addColorPicker(picker => picker
                    .setValue(this.plugin.settings.palette[cs.key] || cs.default)
                    .onChange(async (value) => {
                        this.plugin.settings.palette[cs.key] = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}

class BatchExportModal extends Modal {
    private current = 0;
    private total = 0;
    private cancelled = false;
    private progressBarEl: HTMLElement;
    private statusEl: HTMLElement;
    private fileNameEl: HTMLElement;

    constructor(app: App, total: number) {
        super(app);
        this.total = total;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Batch Export' });

        this.statusEl = contentEl.createEl('p', {
            text: `Exporting 0 / ${this.total} papers...`
        });

        this.fileNameEl = contentEl.createEl('p', {
            text: '',
            cls: 'paper-engine-current-file'
        });
        this.fileNameEl.style.fontSize = '0.85em';
        this.fileNameEl.style.color = 'var(--text-muted)';

        const progressContainer = contentEl.createDiv();
        progressContainer.style.width = '100%';
        progressContainer.style.height = '20px';
        progressContainer.style.backgroundColor = 'var(--background-modifier-border)';
        progressContainer.style.borderRadius = '4px';
        progressContainer.style.overflow = 'hidden';
        progressContainer.style.marginTop = '8px';
        progressContainer.style.marginBottom = '16px';

        this.progressBarEl = progressContainer.createDiv();
        this.progressBarEl.style.height = '100%';
        this.progressBarEl.style.width = '0%';
        this.progressBarEl.style.backgroundColor = '#B8860B';
        this.progressBarEl.style.borderRadius = '4px';
        this.progressBarEl.style.transition = 'width 0.3s ease';

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .setWarning()
                .onClick(() => {
                    this.cancelled = true;
                    this.statusEl.setText('Cancelling...');
                }));
    }

    updateProgress(current: number, fileName: string) {
        this.current = current;
        const pct = Math.round((current / this.total) * 100);
        this.progressBarEl.style.width = `${pct}%`;
        this.statusEl.setText(`Exporting ${current} / ${this.total} papers...`);
        this.fileNameEl.setText(fileName);
    }

    isCancelled(): boolean {
        return this.cancelled;
    }

    complete() {
        this.statusEl.setText(`Done. ${this.current} / ${this.total} papers exported.`);
        this.progressBarEl.style.width = '100%';
        this.progressBarEl.style.backgroundColor = '#6B8C42';
        this.fileNameEl.setText('');
    }

    onClose() {
        this.contentEl.empty();
    }
}
```

---

## 9. PYTHON-SIDE FLAGS NOT YET IMPLEMENTED

The TypeScript plugin now passes these flags, but `paper_engine.py` does not yet consume them. The next step is to add support in `paper_engine.py`:

| Flag | Python argparse line to add | Implementation needed |
|------|----------------------------|----------------------|
| `--cover` | `parser.add_argument('--cover', action='store_true', help='Include branded cover page')` | Add cover page generation before the title block in `convert_md_to_docx()` |
| `--scores` | `parser.add_argument('--scores', type=str, default=None, help='JSON string of 7Q scores')` | Parse with `json.loads(args.scores)`, inject score card table into the document |
| `--template` | `parser.add_argument('--template', choices=['opus', 'claude', 'custom'], default='opus', help='Template style')` | Route to different formatting functions based on the template choice |

---

## 10. SUMMARY OF ALL FILES MODIFIED

| File | Changes |
|------|---------|
| `obsidian-plugin/main.ts` | All 5 tasks modify this file. See Section 8 for final state. |
| `obsidian-plugin/manifest.json` | No changes needed. |
| `paper_engine.py` | Not modified by these tasks. See Section 9 for future Python work. |

---

*Written for OpenAI Codex. Last updated: 2026-03-21.*
