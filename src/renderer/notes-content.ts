export type EditableNotesDocument = {
  html: string;
  type: 'html';
};

export function createEditableNotesDocument(html: string): EditableNotesDocument {
  return {
    html,
    type: 'html',
  };
}

export function noteResponseToHtml(note: GarlicSauceSlideNote): string {
  const html = note.contentJson.html;

  if (typeof html === 'string') {
    return html;
  }

  return plainTextToHtml(note.plainText);
}

export function plainTextToHtml(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n');

  if (lines.length === 1 && lines[0].length === 0) {
    return '';
  }

  return lines
    .map((line) => (line.length > 0 ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
