import JSZip from 'jszip';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const downloadTextFile = (filename: string, content: string) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  // Ensure filename ends in .txt
  const name = filename.substring(0, filename.lastIndexOf('.')) + '.txt';
  element.download = name;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const downloadAsZip = async (files: { filename: string; content: string }[]) => {
  const zip = new JSZip();
  
  // Track filenames to prevent duplicates overwriting each other
  const usedNames: Record<string, number> = {};

  files.forEach(({ filename, content }) => {
    let baseName = filename.substring(0, filename.lastIndexOf('.')); // remove extension
    // Fallback if no extension
    if (baseName === '') baseName = filename;
    
    let txtName = `${baseName}.txt`;

    // Handle duplicate filenames
    if (usedNames[txtName]) {
      usedNames[txtName]++;
      txtName = `${baseName}_${usedNames[txtName]}.txt`;
    } else {
      usedNames[txtName] = 0;
    }

    zip.file(txtName, content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  
  const element = document.createElement('a');
  element.href = URL.createObjectURL(blob);
  element.download = 'captions.zip';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(element.href);
};

export const extractImagesFromZip = async (zipFile: File): Promise<File[]> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  const imageFiles: File[] = [];

  const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

  // Using for...of loop with Object.keys to support async properly
  for (const filename of Object.keys(loadedZip.files)) {
    const file = loadedZip.files[filename];
    
    if (file.dir) continue;
    
    const lowerName = filename.toLowerCase();
    const isValidImage = validExtensions.some(ext => lowerName.endsWith(ext));
    
    // Ignore hidden files (specifically __MACOSX garbage)
    if (isValidImage && !lowerName.includes('__macosx') && !filename.startsWith('.')) {
      const blob = await file.async('blob');
      // Create a File object from the Blob, keeping the original name (stripping paths)
      const cleanName = filename.split('/').pop() || filename;
      
      // Fix for missing MIME type in extracted files
      let mimeType = blob.type;
      if (!mimeType || mimeType === '') {
        if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
        else if (lowerName.endsWith('.bmp')) mimeType = 'image/bmp';
      }

      imageFiles.push(new File([blob], cleanName, { type: mimeType }));
    }
  }

  return imageFiles;
};