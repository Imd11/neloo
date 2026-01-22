import { Template } from 'e2b'

export const template = Template()
  // Use official code-interpreter image as base
  // Already includes: pandas, numpy, scipy, matplotlib, seaborn, plotly, bokeh,
  //                   pillow, opencv-python, scikit-learn, scikit-image, openpyxl,
  //                   python-docx, requests, beautifulsoup4, sympy, nltk, spacy
  .fromImage('e2bdev/code-interpreter')

  // ==========================================================
  // Document Generation Packages
  // ==========================================================
  .runCmd('pip install --no-cache-dir python-pptx reportlab xlsxwriter')

  // ==========================================================
  // PDF Processing Packages
  // ==========================================================
  .runCmd('pip install --no-cache-dir pypdf pdfplumber pdf2image')

  // ==========================================================
  // Statistical & Econometrics Packages
  // ==========================================================
  .runCmd('pip install --no-cache-dir statsmodels linearmodels')

  // ==========================================================
  // OCR & System Tools (requires sudo for apt-get)
  // Install tesseract for OCR and poppler-utils for pdf2image
  // ==========================================================
  .runCmd('sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-chi-tra poppler-utils && sudo rm -rf /var/lib/apt/lists/*')
  .runCmd('pip install --no-cache-dir pytesseract')

  // ==========================================================
  // Security & Utility Packages
  // ==========================================================
  .runCmd('pip install --no-cache-dir defusedxml "markitdown[pptx]"')

  // ==========================================================
  // Verification
  // ==========================================================
  .runCmd('python3 -c "import pptx; import reportlab; import pypdf; import pdfplumber; import statsmodels; import pytesseract; import defusedxml; print(\'All packages installed successfully\')"')