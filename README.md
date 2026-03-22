# Theophysics Paper Engine

Convert Theophysics markdown papers to styled Word documents and PDFs with the official color palette.

## Features

- **Markdown to styled .docx** — Georgia/Consolas fonts, gold/navy color palette, colored tables
- **Auto PDF export** — Optional one-step `.md → .docx → .pdf` pipeline
- **7Q Score Templates** — Two template designs for scored papers (Opus and Claude variants)
- **Batch processing** — Convert all papers at once or target specific files
- **Obsidian-compatible** — Strips wiki-links, callouts, frontmatter automatically

## Quick Start

```bash
pip install -r requirements.txt

# Convert all FT-*.md files in current directory
python paper_engine.py

# Convert specific files
python paper_engine.py paper1.md paper2.md

# Convert and auto-export to PDF
python paper_engine.py --pdf

# Generate 7Q score templates
python paper_engine.py --templates
```

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Header accent | Gold | `#B8860B` |
| Section headings | Navy | `#1A3C5E` |
| Subheadings | Blue | `#2C5F8A` |
| Metadata | Gray | `#888888` |
| Body text | Black | `#000000` |
| Subtitle | Dark gray | `#555555` |

### 7Q Dimension Colors

| Q | Dimension | Color | Hex |
|---|-----------|-------|-----|
| Q0 | Arrive | Gray | `#8A8D9B` |
| Q1 | Define | Gold | `#D4A853` |
| Q2 | Locate | Brown | `#7C6340` |
| Q3 | Commit | Green | `#6B8C42` |
| Q4 | Support | Blue | `#38BDF8` |
| Q5 | Ground | Earth | `#A0724A` |
| Q6 | Propagate | Emerald | `#34D399` |
| Q7 | Falsification | Red | `#EF4444` |

## File Structure

```
theophysics-paper-engine/
  paper_engine.py          # Main converter (md → docx → pdf)
  templates.py             # 7Q scored paper template builder
  requirements.txt         # Python dependencies
  obsidian-plugin/         # Obsidian plugin scaffold (future)
    manifest.json
    main.ts
```

## Requirements

- Python 3.10+
- python-docx
- docx2pdf (for PDF export, requires Word or LibreOffice installed)

## Author

David Lowe | Theophysics Research | theophysics.pro
