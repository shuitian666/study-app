# Knowledge Extractor

Extract knowledge points from e-books (PDF, TXT, EPUB) and import to study app.

## Install

```bash
cd knowledge-extractor
pip install -r requirements.txt
```

## Usage

### Basic

```bash
# Extract single PDF
python main.py your_book.pdf

# With subject
python main.py your_book.pdf --subject "Chinese Medicine" --subject-id "tcm"

# Process directory
python main.py ./books/ --subject "Chemistry" --subject-id "chem"
```

### Output Formats

```bash
# JSON (recommended)
python main.py book.pdf -o knowledge.json

# CSV
python main.py book.pdf -o knowledge.csv

# JavaScript (copy to browser console)
python main.py book.pdf -o import.js --format js
```

## Import to Knowledge Base

### Method 1: Console Import

1. Open study app in browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Copy content from .js file and paste
5. Press Enter to execute

### Method 2: Manual

```javascript
// In browser console
const newData = [/* paste knowledgePoints array */];
const existing = JSON.parse(localStorage.getItem('smart_study_knowledge') || '[]');
const merged = [...existing, ...newData];
localStorage.setItem('smart_study_knowledge', JSON.stringify(merged));
location.reload();
```

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| PDF | .pdf | E-books, papers |
| Text | .txt | Plain text |
| EPUB | .epub | E-book format |
| Markdown | .md | Documents |

## Quick Start

```bash
# Quick import (recommended)
python quick_import.py "book.pdf"

# With Chinese subject auto-detection
python quick_import.py "中药学.pdf"
```
