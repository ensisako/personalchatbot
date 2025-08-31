declare module 'pdf-parse' {
  export interface PdfParseOptions {
    max?: number;
    pagerender?: (page: any) => Promise<string> | string;
    version?: string;
  }

  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata?: unknown;
    text: string;
    version: string;
  }

  // Default export is a function: pdfParse(buffer, options?)
  export default function pdfParse(
    data: Buffer | ArrayBuffer | Uint8Array,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;
}
