import { Fragment } from 'react';

interface StudyRichTextProps {
  text: string;
}

function normalizeBlocks(text: string) {
  return text
    .replace(/\s+(?=\d+\.\s+)/g, '\n')
    .replace(/\s+-\s+(?=(?:\*\*)?[\p{L}])/gu, '\n• ')
    .replace(/(^|\n)\*\s+/g, '$1• ');
}

export default function StudyRichText({ text }: StudyRichTextProps) {
  const parts = normalizeBlocks(text).split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
        }
        return <Fragment key={`${index}-${part}`}>{part}</Fragment>;
      })}
    </>
  );
}
