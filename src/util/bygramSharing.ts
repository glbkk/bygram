import type { ApiMessage } from '../api/types';

import { getArchivedChatMessages } from './bygramArchive';

type ExportLabels = {
  deleted: string;
  edited: string;
  media: string;
  title: string;
};

type MessageShotLabels = {
  deleted: string;
  edited: string;
  media: string;
};

const HTML_MIME_TYPE = 'text/html;charset=utf-8';
const PNG_MIME_TYPE = 'image/png';
const SHOT_WIDTH = 720;
const SHOT_HORIZONTAL_PADDING = 48;
const SHOT_VERTICAL_PADDING = 44;
const SHOT_HEADER_HEIGHT = 50;
const SHOT_LINE_HEIGHT = 32;
const SHOT_FONT_SIZE = 24;
const SHOT_META_FONT_SIZE = 19;
const SHOT_BUBBLE_RADIUS = 30;
const SHOT_MAX_LINES = 220;
const SHOT_SCALE = 2;

export async function exportBygramChat(
  chatId: string,
  chatTitle: string,
  labels: ExportLabels,
  getAuthor: (senderId: string) => string,
) {
  const records = await getArchivedChatMessages(chatId);
  if (!records.length) return false;

  const rows = records.map(({ message, deletedAt, versions }) => {
    const text = getMessageText(message, labels.media);
    const author = getAuthor(message.senderId || message.chatId);
    const classes = [message.isOutgoing ? 'outgoing' : '', deletedAt ? 'deleted' : ''].filter(Boolean).join(' ');
    const badges = [
      deletedAt ? labels.deleted : undefined,
      versions.length ? `${labels.edited}: ${versions.length}` : undefined,
    ].filter((badge): badge is string => Boolean(badge))
      .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('');

    return `<article class="message ${classes}">
      <header><strong>${escapeHtml(author)}</strong><time>${escapeHtml(formatDate(message.date))}</time></header>
      <div class="text">${escapeHtml(text).replaceAll('\n', '<br>')}</div>
      ${badges ? `<footer>${badges}</footer>` : ''}
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(chatTitle)} — bygram</title><style>
:root {
  color-scheme: light dark;
  font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #dfe8ef;
  color: #17212b;
}
body {
  box-sizing: border-box;
  max-width: 54rem;
  min-height: 100vh;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  background: linear-gradient(135deg, #d7e8f5, #f1eee8);
}
h1 { margin: 0 0 .25rem; }
.summary { margin: 0 0 2rem; color: #657786; }
.message {
  box-sizing: border-box;
  width: min(85%, 42rem);
  margin: .6rem 0;
  padding: .75rem 1rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 .125rem .5rem #0001;
}
.message.outgoing { margin-left: auto; background: #dcf8c6; }
.message.deleted { opacity: .72; }
.message header {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  color: #2481cc;
  font-size: .85rem;
}
.message time { color: #728391; }
.text { margin-top: .3rem; overflow-wrap: anywhere; }
.message footer { display: flex; gap: .35rem; margin-top: .5rem; }
.badge {
  padding: .1rem .45rem;
  border-radius: 999px;
  background: #0001;
  color: #687684;
  font-size: .75rem;
}
@media (prefers-color-scheme: dark) {
  :root { background: #0e1621; color: #f5f5f5; }
  body { background: linear-gradient(135deg, #152d3d, #151c25); }
  .message { background: #182533; }
  .message.outgoing { background: #2b5278; }
  .summary, .message time { color: #a7b4bd; }
  .badge { background: #fff2; color: #c4cdd3; }
}
</style></head><body><h1>${escapeHtml(chatTitle)}</h1>
<p class="summary">${escapeHtml(labels.title)} · ${records.length}</p>${rows}</body></html>`;

  downloadBlob(new Blob([html], { type: HTML_MIME_TYPE }), `${sanitizeFileName(chatTitle)}-bygram.html`);
  return true;
}

export async function shareBygramMessageShot(
  message: ApiMessage,
  author: string,
  labels: MessageShotLabels,
) {
  const canvas = createMessageShotCanvas(message, author, labels);
  const blob = await canvasToBlob(canvas);
  const fileName = `bygram-message-${message.id}.png`;
  const file = new File([blob], fileName, { type: PNG_MIME_TYPE });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }

  downloadBlob(blob, fileName);
}

function createMessageShotCanvas(message: ApiMessage, author: string, labels: MessageShotLabels) {
  const canvas = document.createElement('canvas');
  const measureContext = canvas.getContext('2d')!;
  measureContext.font = `${SHOT_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const text = getMessageText(message, labels.media);
  const lines = wrapText(measureContext, text, SHOT_WIDTH - SHOT_HORIZONTAL_PADDING * 2, SHOT_MAX_LINES);
  const metaHeight = message.isEdited || message.isBygramDeleted ? SHOT_LINE_HEIGHT : 0;
  const height = SHOT_VERTICAL_PADDING * 2 + SHOT_HEADER_HEIGHT + lines.length * SHOT_LINE_HEIGHT + metaHeight;

  canvas.width = SHOT_WIDTH * SHOT_SCALE;
  canvas.height = height * SHOT_SCALE;
  const context = canvas.getContext('2d')!;
  context.scale(SHOT_SCALE, SHOT_SCALE);
  drawShotBackground(context, height, message.isOutgoing);

  context.fillStyle = message.isOutgoing ? '#17212b' : '#2481cc';
  context.font = `600 ${SHOT_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.fillText(author, SHOT_HORIZONTAL_PADDING, SHOT_VERTICAL_PADDING + SHOT_FONT_SIZE);

  context.fillStyle = '#17212b';
  context.font = `${SHOT_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
  lines.forEach((line, index) => {
    context.fillText(
      line,
      SHOT_HORIZONTAL_PADDING,
      SHOT_VERTICAL_PADDING + SHOT_HEADER_HEIGHT + SHOT_FONT_SIZE + index * SHOT_LINE_HEIGHT,
    );
  });

  const meta = [message.isEdited ? labels.edited : undefined, message.isBygramDeleted ? labels.deleted : undefined]
    .filter(Boolean).join(' · ');
  context.fillStyle = '#6d7f8b';
  context.font = `${SHOT_META_FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = 'right';
  context.fillText(
    [meta, formatDate(message.date)].filter(Boolean).join('  '),
    SHOT_WIDTH - SHOT_HORIZONTAL_PADDING,
    height - SHOT_VERTICAL_PADDING / 2,
  );

  return canvas;
}

function drawShotBackground(context: CanvasRenderingContext2D, height: number, isOutgoing: boolean) {
  context.fillStyle = '#d9e8f2';
  context.fillRect(0, 0, SHOT_WIDTH, height);
  context.beginPath();
  context.roundRect(20, 20, SHOT_WIDTH - 40, height - 40, SHOT_BUBBLE_RADIUS);
  context.fillStyle = isOutgoing ? '#dcf8c6' : '#ffffff';
  context.fill();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      if (lines.length === maxLines) break;
    }
    if (lines.length === maxLines) break;
    lines.push(line || ' ');
  }

  if (lines.length === maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
  }
  return lines;
}

function getMessageText(message: ApiMessage, mediaLabel: string) {
  const text = message.content.text?.text.trim();
  if (text) return text;
  if (message.content.document?.fileName) return `${mediaLabel}: ${message.content.document.fileName}`;
  if (message.content.audio?.fileName) return `${mediaLabel}: ${message.content.audio.fileName}`;
  if (message.content.sticker?.emoji) return `${mediaLabel}: ${message.content.sticker.emoji}`;
  return mediaLabel;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#039;',
  }[character]!));
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || 'chat';
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas export failed'));
      }
    }, PNG_MIME_TYPE);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
