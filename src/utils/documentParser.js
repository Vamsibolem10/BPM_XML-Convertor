import mammoth from 'mammoth';

// Load PDF.js from CDN dynamically to avoid Vite worker bundle resolution errors
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library'));
    document.head.appendChild(script);
  });
};

/**
 * Parses a TXT file
 */
const parseTxt = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
};

/**
 * Parses a DOCX file using mammoth
 */
const parseDocx = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value);
      } catch (err) {
        reject(new Error(`Failed to parse DOCX: ${err.message}`));
      }
    };
    reader.onerror = (e) => reject(new Error('Failed to read DOCX file'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses a PDF file using CDN loaded PDF.js
 */
const parsePdf = async (file) => {
  const pdfjsLib = await loadPdfJs();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (err) {
        reject(new Error(`Failed to parse PDF: ${err.message}`));
      }
    };
    reader.onerror = (e) => reject(new Error('Failed to read PDF file'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Main parser router
 */
export const parseDocument = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'txt':
    case 'md':
    case 'json':
    case 'csv':
      return await parseTxt(file);
    case 'docx':
      return await parseDocx(file);
    case 'pdf':
      return await parsePdf(file);
    default:
      // Try to read it as plain text as a fallback
      try {
        return await parseTxt(file);
      } catch (e) {
        throw new Error(`Unsupported file type: .${extension}`);
      }
  }
};
