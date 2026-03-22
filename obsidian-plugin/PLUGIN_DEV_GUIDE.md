# Obsidian Plugin Development Guide
## For AI Co-Laborers (Claude, Codex, GPT)

*Read this before touching the plugin code. This is your build manual.*

---

## Project Setup

```bash
# Clone the sample plugin as starting point
git clone https://github.com/obsidianmd/obsidian-sample-plugin.git
cd obsidian-sample-plugin
npm install
npm run dev    # Watch mode — rebuilds on save
```

### Required Files
```
obsidian-plugin/
  manifest.json       # Plugin identity (id, name, version, minAppVersion)
  main.ts             # Entry point — extends Plugin
  styles.css          # Optional CSS
  package.json        # Node dependencies
  tsconfig.json       # TypeScript config
  esbuild.config.mjs  # Build config
```

### manifest.json
```json
{
  "id": "theophysics-paper-engine",
  "name": "Theophysics Paper Engine",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "Export markdown to styled Word/PDF with Theophysics palette",
  "author": "David Lowe",
  "authorUrl": "https://theophysics.pro",
  "isDesktopOnly": true
}
```

---

## Plugin Lifecycle

```typescript
import { Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
  async onload() {
    // Called when plugin is activated
    // Register commands, events, views, settings here
    console.log('Plugin loaded');
  }

  async onunload() {
    // Called when plugin is disabled
    // Clean up ALL resources acquired in onload()
    console.log('Plugin unloaded');
  }
}
```

**CRITICAL:** Everything registered in `onload()` must be cleaned up in `onunload()`. Use `this.register()` and `this.registerEvent()` for automatic cleanup.

---

## Commands

```typescript
// Basic command
this.addCommand({
  id: 'export-current-note',
  name: 'Export current note to Word',
  callback: async () => {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    // do work
  }
});

// Editor command (has access to editor + view)
this.addCommand({
  id: 'insert-template',
  name: 'Insert 7Q template',
  editorCallback: (editor, view) => {
    editor.replaceSelection('## 7Q Analysis\n');
  }
});

// Conditional command (only shows when check passes)
this.addCommand({
  id: 'export-if-formal',
  name: 'Export formal paper',
  checkCallback: (checking) => {
    const file = this.app.workspace.getActiveFile();
    const isFormal = file && /^(FT-|FP-)/.test(file.basename);
    if (checking) return !!isFormal;
    if (isFormal) { /* do export */ }
  }
});
```

---

## Ribbon Icon

```typescript
this.addRibbonIcon('file-output', 'Export to Word/PDF', async () => {
  new Notice('Exporting...');
});
```

Available icons: Use any Lucide icon name. Common ones:
`dice`, `file-output`, `download`, `settings`, `search`, `book`, `edit`, `trash`, `check`, `x`

---

## Settings

```typescript
interface MySettings {
  pythonPath: string;
  autoPdf: boolean;
  outputDir: string;
  palette: Record<string, string>;
}

const DEFAULTS: MySettings = {
  pythonPath: 'python',
  autoPdf: true,
  outputDir: '',
  palette: { header: '#B8860B', heading: '#1A3C5E' }
};

// In Plugin class:
async loadSettings() {
  this.settings = Object.assign({}, DEFAULTS, await this.loadData());
}
async saveSettings() {
  await this.saveData(this.settings);
}
```

### Settings Tab

```typescript
import { PluginSettingTab, Setting } from 'obsidian';

class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Text input
    new Setting(containerEl)
      .setName('Python path')
      .setDesc('Path to Python executable')
      .addText(text => text
        .setPlaceholder('python')
        .setValue(this.plugin.settings.pythonPath)
        .onChange(async (value) => {
          this.plugin.settings.pythonPath = value;
          await this.plugin.saveSettings();
        }));

    // Toggle
    new Setting(containerEl)
      .setName('Auto PDF')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoPdf)
        .onChange(async (value) => {
          this.plugin.settings.autoPdf = value;
          await this.plugin.saveSettings();
        }));

    // Dropdown
    new Setting(containerEl)
      .setName('Theme')
      .addDropdown(dd => dd
        .addOption('gold', 'Gold (Default)')
        .addOption('navy', 'Navy')
        .addOption('minimal', 'Minimal')
        .setValue(this.plugin.settings.theme)
        .onChange(async (value) => {
          this.plugin.settings.theme = value;
          await this.plugin.saveSettings();
        }));

    // Slider
    new Setting(containerEl)
      .setName('Font size')
      .addSlider(slider => slider
        .setLimits(8, 24, 1)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.fontSize = value;
          await this.plugin.saveSettings();
        }));

    // Color picker (as text input with hex)
    new Setting(containerEl)
      .setName('Header accent color')
      .addText(text => text
        .setPlaceholder('#B8860B')
        .setValue(this.plugin.settings.palette.header)
        .onChange(async (value) => {
          this.plugin.settings.palette.header = value;
          await this.plugin.saveSettings();
        }));
  }
}
```

---

## Vault Operations (File I/O)

```typescript
// List all markdown files
const files = this.app.vault.getMarkdownFiles();

// Read file content
const content = await this.app.vault.read(file);        // For modifications
const cached = await this.app.vault.cachedRead(file);    // For display only

// Create a file
const newFile = await this.app.vault.create('path/file.md', 'content');

// Modify a file safely (atomic read-modify-write)
await this.app.vault.process(file, (data) => {
  return data + '\n\nAppended text';
});

// Delete a file
await this.app.vault.delete(file);

// Rename/move
await this.app.vault.rename(file, 'new/path/name.md');

// Check if path exists
const abstract = this.app.vault.getAbstractFileByPath('some/path');
if (abstract instanceof TFile) { /* file */ }
if (abstract instanceof TFolder) { /* folder */ }
```

---

## Workspace

```typescript
// Get active file
const file = this.app.workspace.getActiveFile();

// Get active editor
const editor = this.app.workspace.activeEditor?.editor;

// Open a file
const leaf = this.app.workspace.getLeaf(false);
await leaf.openFile(file);

// Open in new tab
const newLeaf = this.app.workspace.getLeaf('tab');
await newLeaf.openFile(file);

// Wait for workspace to be ready (IMPORTANT for startup operations)
this.app.workspace.onLayoutReady(() => {
  // Safe to access workspace here
});
```

---

## Events

```typescript
// File events — use registerEvent for auto-cleanup
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (file instanceof TFile) console.log('Created:', file.path);
  })
);

this.registerEvent(
  this.app.vault.on('modify', (file) => {
    console.log('Modified:', file.path);
  })
);

this.registerEvent(
  this.app.vault.on('delete', (file) => {
    console.log('Deleted:', file.path);
  })
);

this.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => {
    console.log('Renamed:', oldPath, '->', file.path);
  })
);

// IMPORTANT: Guard startup events
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (!this.app.workspace.layoutReady) return; // Skip during indexing
    // handle create
  })
);
```

---

## Modals

```typescript
import { Modal, App } from 'obsidian';

class ExportModal extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Export Settings' });

    new Setting(contentEl)
      .setName('Output format')
      .addDropdown(dd => dd
        .addOption('docx', 'Word (.docx)')
        .addOption('pdf', 'PDF (.pdf)')
        .onChange(value => this.result = value));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Export')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.result);
        }));
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Usage:
new ExportModal(this.app, (format) => {
  console.log('Export as:', format);
}).open();
```

---

## Notices

```typescript
import { Notice } from 'obsidian';

new Notice('Quick message');                    // 5 second default
new Notice('Longer message', 10000);            // 10 seconds
new Notice('Export complete!');
```

---

## Running External Processes (Python Bridge)

This is how the Paper Engine calls Python from within Obsidian:

```typescript
import { exec } from 'child_process';

async exportWithPython(mdPath: string, outDir: string) {
  const enginePath = this.getEnginePath();
  const pdfFlag = this.settings.autoPdf ? '--pdf' : '';

  const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${mdPath}" --out "${outDir}" ${pdfFlag}`;

  return new Promise<string>((resolve, reject) => {
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}
```

**IMPORTANT:** `isDesktopOnly: true` is required in manifest.json for `child_process` access.

---

## CSS Snippets

Place CSS files in `.obsidian/snippets/` and enable in Settings > Appearance > CSS Snippets.

```css
/* Custom callout type */
.callout[data-callout="theophysics"] {
  --callout-color: 184, 134, 11;
  --callout-icon: lucide-book;
  border-left: 3px solid #B8860B;
}

/* Style callout title */
.callout[data-callout="theophysics"] .callout-title {
  color: #B8860B;
  font-weight: 700;
}

/* Callout content */
.callout[data-callout="theophysics"] .callout-content {
  font-size: 0.9rem;
  line-height: 1.5;
}
```

---

## Status Bar

```typescript
const statusBar = this.addStatusBarItem();
statusBar.setText('Papers: 0');

// Update later
statusBar.setText('Papers: 16 ready');
```

---

## Best Practices

1. **Memory Management:** Use `this.register()` and `this.registerEvent()` — they auto-cleanup on unload
2. **Don't block startup:** Defer heavy work with `this.app.workspace.onLayoutReady()`
3. **Use `cachedRead` for display**, `read` only when you need to modify
4. **Use `process()` for file modifications** — it's atomic and safe
5. **Guard vault events** during initial indexing (check `layoutReady`)
6. **`isDesktopOnly: true`** if you use Node.js APIs (fs, child_process, path)
7. **Never store absolute paths** in settings — use vault-relative paths
8. **Test with Obsidian dev tools:** Ctrl+Shift+I opens the console

---

## Submission Checklist (Community Plugins)

- [ ] `manifest.json` has correct `id`, `name`, `version`, `minAppVersion`
- [ ] No `console.log` in production (use conditional logging)
- [ ] All resources cleaned up in `onunload()`
- [ ] Settings persist correctly across reload
- [ ] Works with both light and dark themes
- [ ] No hardcoded paths
- [ ] README.md with usage instructions
- [ ] LICENSE file included
- [ ] Tested on latest Obsidian version

---

## This Plugin's Architecture

```
theophysics-paper-engine/
  paper_engine.py       ← Python: md → docx → pdf
  templates.py          ← Python: generates 7Q score templates
  config.json           ← Swappable colors, fonts, branding
  obsidian-plugin/
    manifest.json       ← Plugin identity
    main.ts             ← Plugin entry: commands, settings, Python bridge
    PLUGIN_DEV_GUIDE.md ← This file (you are here)
```

### Commands Implemented
- `export-current-note` — Export active note to Word
- `export-current-note-pdf` — Export active note to PDF
- `generate-templates` — Create 7Q score template docs
- `batch-export` — Export all FT-*/FP-*/SP* papers at once

### Settings Implemented
- Python path (auto-detected)
- Engine script path (auto-detected from plugin folder)
- Output directory
- Auto-PDF toggle
- Open folder after export
- Color palette overrides (header accent, heading primary/secondary)

### Extension Points for Next AI
- [ ] Add color picker UI (not just hex text input)
- [ ] Add cover page generator with logo
- [ ] Add preview pane showing docx render
- [ ] Add frontmatter-based auto-scoring (read 7Q YAML → inject score card)
- [ ] Add Zenodo upload integration (API key in settings)
- [ ] Add batch progress bar modal
- [ ] Support custom CSS-to-docx style mapping
- [ ] Add template selector dropdown (Opus vs Claude vs custom)

---

*Last updated: 2026-03-21 | Claude Opus 4.6*
