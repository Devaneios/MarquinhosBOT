import { getDocumentProxy } from 'unpdf';
import { z } from 'zod';

declare const self: Worker;

export const MAX_PDF_PAGES = 20;

const pdfInfoSchema = z.object({ Title: z.string() });

interface PdfWorkerRequest {
  bytes: Uint8Array;
  maxPages?: number;
}

interface PdfWorkerSuccess {
  ok: true;
  title: string;
  text: string;
}

interface PdfWorkerFailure {
  ok: false;
  error: string;
}

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  try {
    const pdf = await getDocumentProxy(event.data.bytes);
    try {
      let title = '';
      try {
        const metadata = await pdf.getMetadata();
        const info = pdfInfoSchema.safeParse(metadata.info);
        if (info.success) title = info.data.Title.trim();
      } catch {
        // Metadata is a nicety; the search hit's title already covers us.
      }

      const maxPages = event.data.maxPages ?? MAX_PDF_PAGES;
      const pages: string[] = [];
      const limit = Math.min(pdf.numPages, maxPages);
      for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        );
      }

      const response: PdfWorkerSuccess = {
        ok: true,
        title,
        text: pages.filter(Boolean).join('\n\n'),
      };
      self.postMessage(response);
    } finally {
      await pdf.cleanup();
    }
  } catch (error) {
    const response: PdfWorkerFailure = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
