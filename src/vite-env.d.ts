/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'chapter-and-verse/index.js' {
  export interface ChapterAndVerseBook {
    id: string;
    name: string;
    testament: 'O' | 'N';
    chapters: number;
    versesPerChapter: number[];
  }

  export interface ChapterAndVerseResult {
    success: boolean;
    reason?: string;
    book?: ChapterAndVerseBook;
    chapter?: number;
    from?: number;
    to?: number;
  }

  export default function chapterAndVerse(reference: string): ChapterAndVerseResult;
}
