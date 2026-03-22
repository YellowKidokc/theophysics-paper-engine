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
    palette: Record<string, string>;
}

const DEFAULT_SETTINGS: PaperEngineSettings = {
    pythonPath: 'python',
    enginePath: '',  // Auto-detected from plugin folder
    outputDir: '',   // Default: vault root / exports
    autoPdf: true,
    openAfterExport: true,
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
        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" "${tmpMd}" --out "${outDir}" ${pdfFlag}`;

        new Notice(`Exporting ${file.basename}...`);

        exec(cmd, (error, stdout, stderr) => {
            // Clean up temp file
            try { fs.unlinkSync(tmpMd); } catch {}
            try { fs.rmdirSync(tmpDir); } catch {}

            if (error) {
                new Notice(`Export failed: ${stderr || error.message}`);
                console.error('Paper Engine error:', error);
                return;
            }

            new Notice(`Exported: ${file.basename}.docx`);
            console.log('Paper Engine:', stdout);

            if (this.settings.openAfterExport) {
                // Open the output folder
                exec(`explorer "${outDir.replace(/\//g, '\\\\')}"`);
            }
        });
    }

    async generateTemplates() {
        const outDir = this.settings.outputDir ||
                       path.join(this.app.vault.adapter.getBasePath(), 'exports');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const enginePath = this.getEnginePath();
        const cmd = `"${this.settings.pythonPath}" "${enginePath}" --templates --out "${outDir}"`;

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

        new Notice(`Batch exporting ${files.length} papers...`);
        for (const file of files) {
            await this.exportFile(file);
        }
    }

    getEnginePath(): string {
        if (this.settings.enginePath) return this.settings.enginePath;
        // Default: look in plugin folder
        const pluginDir = path.join(
            this.app.vault.adapter.getBasePath(),
            '.obsidian', 'plugins', 'theophysics-paper-engine'
        );
        return path.join(pluginDir, 'paper_engine.py');
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
                .addText(text => text
                    .setPlaceholder(cs.default)
                    .setValue(this.plugin.settings.palette[cs.key] || cs.default)
                    .onChange(async (value) => {
                        this.plugin.settings.palette[cs.key] = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
