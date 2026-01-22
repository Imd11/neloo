# E2B Custom Dockerfile for Data Analyst Sandbox
# This Dockerfile defines dependencies for document generation tools

FROM e2bdev/code-interpreter:latest

# ============================================================
# Python Dependencies for Document Generation
# ============================================================
RUN pip install --no-cache-dir \
    # Excel generation & processing
    openpyxl \
    xlsxwriter \
    xlrd \
    # Word document generation
    python-docx \
    # PowerPoint generation
    python-pptx \
    # PDF generation & processing
    reportlab \
    pypdf \
    pdfplumber \
    # Data analysis (should already be installed, but ensure)
    pandas \
    numpy \
    scipy \
    matplotlib \
    seaborn

# ============================================================
# Node.js Dependencies for Advanced PPTX (html2pptx.js)
# ============================================================
# Install Node.js if not already present
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js packages globally for skill scripts
RUN npm install -g \
    pptxgenjs \
    sharp \
    playwright

# Install Playwright browsers (for html2pptx rendering)
RUN npx playwright install chromium --with-deps

# ============================================================
# System Dependencies
# ============================================================
# LibreOffice for recalc.py (Excel formula recalculation)
RUN apt-get update && apt-get install -y \
    libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# Verify Installation
# ============================================================
RUN python3 -c "import openpyxl, python_docx as docx, pptx, reportlab, pypdf; print('Python deps OK')" || \
    python3 -c "import openpyxl; from docx import Document; from pptx import Presentation; from reportlab.pdfgen import canvas; import pypdf; print('Python deps OK')"
RUN node -v && npm -v

# Set working directory
WORKDIR /home/user
