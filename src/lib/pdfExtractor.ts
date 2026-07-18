import * as pdfjsLib from 'pdfjs-dist';

// Point to the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function extractImagesFromPDF(pdfBase64: string): Promise<string[]> {
  try {
    const pdfData = atob(pdfBase64.split('base64,').pop() || pdfBase64);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
        uint8Array[i] = pdfData.charCodeAt(i);
    }

    const extractionPromise = async () => {
      const doc = await pdfjsLib.getDocument({data: uint8Array}).promise;
      const images: string[] = [];
  
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const ops = await page.getOperatorList();
        
        const pageImagePromises = [];
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === (pdfjsLib.OPS as any).paintJpegXObject) {
             const imgName = ops.argsArray[i][0];
             
             pageImagePromises.push(new Promise<any>((resolve) => {
               // Add timeout so we dont hang forever on missing objects
               const timeoutId = setTimeout(() => resolve(null), 500);
               page.objs.get(imgName, (imgData: any) => {
                  clearTimeout(timeoutId);
                  resolve(imgData);
               });
             }));
          }
        }
                const pageImages = await Promise.all(pageImagePromises);

        for (const img of pageImages) {
             if (img && (img.data || img.bitmap) && img.width && img.height) {
               const canvas = document.createElement('canvas');
               canvas.width = img.width;
               canvas.height = img.height;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                  if (img.bitmap) {
                      ctx.drawImage(img.bitmap, 0, 0, img.width, img.height);
                  } else if (img.data) {
                      let data = img.data;
                      const imgData = ctx.createImageData(img.width, img.height);
                      
                      if (data.length === img.width * img.height * 4) {
                          imgData.data.set(data);
                      } else if (data.length === img.width * img.height * 3) {
                          for(let j=0, k=0; j < data.length; j+=3, k+=4) {
                              imgData.data[k] = data[j];
                              imgData.data[k+1] = data[j+1];
                              imgData.data[k+2] = data[j+2];
                              imgData.data[k+3] = 255;
                          }
                      } else if (data.length === img.width * img.height) { // GRAYSCALE
                          for(let j=0, k=0; j < data.length; j++, k+=4) {
                              imgData.data[k] = data[j];
                              imgData.data[k+1] = data[j];
                              imgData.data[k+2] = data[j];
                              imgData.data[k+3] = 255;
                          }
                      }
                      
                      ctx.putImageData(imgData, 0, 0);
                  }
                  
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  if (img.width > 50 && img.height > 50) {
                    images.push(dataUrl);
                  }
               }
             }
          if (images.length >= 30) break; // Hard limit for safety
        }
        if (images.length >= 30) break;
      }
      return images;
    };

    return await Promise.race([
      extractionPromise(),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("Image extraction timeout")), 300000))
    ]);
  } catch (e) {
    console.error("Image extraction failed", e);
    return [];
  }
}
