import { useEffect, useMemo, useState } from 'react';
import { BIBLE_BOOKS, createReference, getBibleBook, getChapterCount, getVerseCount } from '../data/bibleBooks';
import type { BibleReference } from '../types';

interface BibleReferencePickerProps {
  value: BibleReference;
  onChange: (reference: BibleReference) => void;
  label?: string;
}

export default function BibleReferencePicker({ value, onChange, label }: BibleReferencePickerProps) {
  const selectedBook = getBibleBook(value.bookId);
  const [bookQuery, setBookQuery] = useState(selectedBook.spanishName);
  const chapterCount = useMemo(() => getChapterCount(value.bookId), [value.bookId]);
  const verseCount = useMemo(() => getVerseCount(value.bookId, value.chapter), [value.bookId, value.chapter]);

  useEffect(() => {
    setBookQuery(selectedBook.spanishName);
  }, [selectedBook.spanishName]);

  const selectBookByName = (name: string) => {
    const normalized = name.trim().toLocaleLowerCase('es');
    const match = BIBLE_BOOKS.find((book) => book.spanishName.toLocaleLowerCase('es') === normalized);
    if (match) onChange(createReference(match.id, 1, 1));
  };

  return (
    <fieldset className="reference-picker">
      {label && <legend>{label}</legend>}
      <label>
        Libro
        <input
          list="bible-book-options"
          value={bookQuery}
          onChange={(event) => {
            const next = event.target.value;
            setBookQuery(next);
            selectBookByName(next);
          }}
          onBlur={() => {
            selectBookByName(bookQuery);
            setBookQuery(getBibleBook(value.bookId).spanishName);
          }}
          placeholder="Busca un libro"
          autoComplete="off"
        />
        <datalist id="bible-book-options">
          {BIBLE_BOOKS.map((book) => <option key={book.id} value={book.spanishName} />)}
        </datalist>
      </label>
      <div className="reference-row">
        <label>
          Capítulo
          <select
            value={value.chapter}
            onChange={(event) => onChange(createReference(value.bookId, Number(event.target.value), 1))}
          >
            {Array.from({ length: chapterCount }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>{chapter}</option>
            ))}
          </select>
        </label>
        <label>
          Versículo
          <select
            value={value.verse}
            onChange={(event) => onChange(createReference(value.bookId, value.chapter, Number(event.target.value)))}
          >
            {Array.from({ length: verseCount }, (_, index) => index + 1).map((verse) => (
              <option key={verse} value={verse}>{verse}</option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
