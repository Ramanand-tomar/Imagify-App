import { api, uploadMultipart } from "./api";

export interface OCRResult {
  task_id: string;
  text: string;
  language: string;
}

export interface OCRLanguages {
  languages: string[];
}

export const ocrService = {
  getLanguages: async (): Promise<OCRLanguages> => {
    const res = await api.get<OCRLanguages>("/ocr/languages");
    return res.data;
  },

  extractFromImage: async (uri: string, filename: string, language: string): Promise<OCRResult> => {
    return uploadMultipart<OCRResult>(
      "/ocr/image",
      { uri, name: filename, mimeType: "image/jpeg" },
      { language }
    );
  },

  extractFromPdf: async (uri: string, filename: string, language: string): Promise<{ task_id: string }> => {
    return uploadMultipart<{ task_id: string }>(
      "/ocr/pdf",
      { uri, name: filename, mimeType: "application/pdf" },
      { language }
    );
  },
};
