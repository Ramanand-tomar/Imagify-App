import { uploadMultipart } from "./api";

export interface OCRResult {
  // task_id may be null when storage archive failed but extraction succeeded.
  task_id?: string | null;
  text: string;
  language: string;
}

export interface OCRLanguages {
  languages: string[];
}

import { api } from "./api";

export const ocrService = {
  getLanguages: async (): Promise<OCRLanguages> => {
    const res = await api.get<OCRLanguages>("/ocr/languages");
    return res.data;
  },

  /**
   * Pass the real picked mime type. Hard-coding "image/jpeg" caused
   * extractions of PNG/WebP screenshots to fail server-side validation.
   */
  extractFromImage: async (
    uri: string,
    filename: string,
    mimeType: string,
    language: string,
  ): Promise<OCRResult> => {
    return uploadMultipart<OCRResult>(
      "/ocr/image",
      { uri, name: filename, mimeType: mimeType || "image/jpeg" },
      { language },
    );
  },

  extractFromPdf: async (
    uri: string,
    filename: string,
    language: string,
  ): Promise<{ task_id: string }> => {
    return uploadMultipart<{ task_id: string }>(
      "/ocr/pdf",
      { uri, name: filename, mimeType: "application/pdf" },
      { language },
    );
  },
};
