import type { ApiUser } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getChatAvatarHash, getMainUsername, getUserFullName } from '../global/helpers';
import * as mediaLoader from './mediaLoader';

const WIDTH = 1080;
const HEIGHT = 1920;
const MIME_TYPE = 'image/jpeg';
const JPEG_QUALITY = 0.95;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BYGRAM_URL = 'glbkk.github.io/bygram';

export type BygramStreakStoryTemplate = 'telegram' | 'aurora' | 'midnight';

const PALETTES: Record<BygramStreakStoryTemplate, {
  start: string;
  middle: string;
  end: string;
  accent: string;
  glow: string;
  glowSecondary: string;
}> = {
  telegram: {
    start: '#071B33', middle: '#126CA8', end: '#6C4FD3', accent: '#2AABEE', glow: '#57C8FF', glowSecondary: '#A980FF',
  },
  aurora: {
    start: '#073A48', middle: '#167E9A', end: '#7D4EC9', accent: '#53D6E5', glow: '#62F0E2', glowSecondary: '#D88CFF',
  },
  midnight: {
    start: '#050A12', middle: '#102A43', end: '#272052', accent: '#58B8F5', glow: '#2AABEE', glowSecondary: '#826DFF',
  },
};

export async function createBygramStreakStoryFile(
  currentUser: ApiUser,
  peerUser: ApiUser,
  days: number,
  template: BygramStreakStoryTemplate = 'telegram',
) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d')!;

  const palette = PALETTES[template];
  drawBackground(context, palette);
  const [currentAvatar, peerAvatar, appIcon] = await Promise.all([
    loadAvatar(currentUser),
    loadAvatar(peerUser),
    loadAppIcon(),
  ]);

  drawBrand(context, appIcon);
  drawTitle(context, days);
  drawUsers(context, currentUser, peerUser, currentAvatar, peerAvatar, palette.accent);
  drawFooter(context, palette.accent);

  const blob = await canvasToBlob(canvas);
  return new File([blob], `bygram-plane-${days}.jpg`, { type: MIME_TYPE });
}

function drawBackground(context: CanvasRenderingContext2D, palette: typeof PALETTES.telegram) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(0.48, palette.middle);
  gradient.addColorStop(1, palette.end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawGlow(context, 150, 360, 520, palette.glow, 0.34);
  drawGlow(context, 950, 720, 620, palette.glowSecondary, 0.3);
  drawGlow(context, 460, 1630, 700, palette.glow, 0.16);

  context.save();
  context.globalAlpha = 0.065;
  context.strokeStyle = '#FFFFFF';
  context.lineWidth = 3;
  for (let y = 100; y < HEIGHT; y += 230) {
    for (let x = -120 + (y % 460); x < WIDTH + 140; x += 360) {
      context.save();
      context.translate(x, y);
      context.rotate(-0.34);
      drawPlane(context, 38);
      context.stroke();
      context.restore();
    }
  }
  context.restore();

  roundedRect(context, 48, 48, WIDTH - 96, HEIGHT - 96, 76);
  context.fillStyle = 'rgba(4, 16, 35, 0.14)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = 2;
  context.stroke();
}

function drawBrand(context: CanvasRenderingContext2D, appIcon?: HTMLImageElement) {
  const iconSize = 82;
  const iconX = 386;
  const iconY = 185;
  drawAppIcon(context, appIcon, iconX, iconY, iconSize);

  context.textAlign = 'left';
  context.fillStyle = '#FFFFFF';
  context.font = `800 44px ${FONT_FAMILY}`;
  context.fillText('bygram', iconX + iconSize + 24, iconY + 55);
}

function drawTitle(context: CanvasRenderingContext2D, days: number) {
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255, 255, 255, 0.72)';
  context.font = `700 31px ${FONT_FAMILY}`;
  drawTrackedText(context, 'У НАС УЖЕ', WIDTH / 2, 365, 8);

  const daysText = String(days);
  const numberSize = daysText.length >= 5 ? 180 : daysText.length >= 4 ? 208 : 244;
  context.fillStyle = '#FFFFFF';
  context.font = `900 ${numberSize}px ${FONT_FAMILY}`;
  context.shadowColor = 'rgba(3, 19, 44, 0.24)';
  context.shadowBlur = 30;
  context.fillText(daysText, WIDTH / 2, 600, 860);
  context.shadowBlur = 0;

  context.fillStyle = '#FFFFFF';
  context.font = `800 50px ${FONT_FAMILY}`;
  context.fillText(`${pluralizeDays(days)} самолётик в bygram!`, WIDTH / 2, 680, 900);
  context.fillStyle = 'rgba(255, 255, 255, 0.7)';
  context.font = `500 28px ${FONT_FAMILY}`;
  context.fillText('Каждый день — ещё одна глава нашей истории', WIDTH / 2, 735);
}

function drawUsers(
  context: CanvasRenderingContext2D,
  currentUser: ApiUser,
  peerUser: ApiUser,
  currentAvatar?: HTMLImageElement,
  peerAvatar?: HTMLImageElement,
  accent = '#2AABEE',
) {
  const leftX = 326;
  const rightX = WIDTH - leftX;
  const avatarY = 970;

  context.save();
  context.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  context.lineWidth = 5;
  context.setLineDash([12, 18]);
  context.beginPath();
  context.moveTo(leftX + 155, avatarY);
  context.bezierCurveTo(500, avatarY - 50, 580, avatarY + 50, rightX - 155, avatarY);
  context.stroke();
  context.restore();

  drawAvatar(context, currentUser, currentAvatar, leftX, avatarY);
  drawAvatar(context, peerUser, peerAvatar, rightX, avatarY);
  drawPlaneBadge(context, WIDTH / 2, avatarY, accent);

  context.textAlign = 'center';
  context.fillStyle = '#FFFFFF';
  drawUsernamePill(context, formatUserLabel(currentUser), leftX, 1165);
  drawUsernamePill(context, formatUserLabel(peerUser), rightX, 1165);
}

function drawAvatar(
  context: CanvasRenderingContext2D,
  user: ApiUser,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
) {
  const radius = 142;
  context.save();
  context.shadowColor = 'rgba(4, 17, 40, 0.36)';
  context.shadowBlur = 34;
  context.beginPath();
  context.arc(x, y, radius + 11, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.fill();
  context.shadowBlur = 0;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();

  if (image) {
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const gradient = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    gradient.addColorStop(0, '#64B5F6');
    gradient.addColorStop(1, '#7459D9');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `800 86px ${FONT_FAMILY}`;
    context.fillText(getInitials(getUserFullName(user) || ''), x, y + 4);
  }
  context.restore();
}

function drawPlaneBadge(context: CanvasRenderingContext2D, x: number, y: number, accent: string) {
  context.beginPath();
  context.arc(x, y, 86, 0, Math.PI * 2);
  context.fillStyle = '#FFFFFF';
  context.shadowColor = 'rgba(4, 17, 40, 0.42)';
  context.shadowBlur = 36;
  context.fill();
  context.shadowBlur = 0;

  context.save();
  context.translate(x, y);
  context.rotate(-0.25);
  context.fillStyle = accent;
  drawPlane(context, 43);
  context.fill();
  context.restore();
}

function drawFooter(context: CanvasRenderingContext2D, accent: string) {
  const x = 106;
  const y = 1360;
  const width = WIDTH - x * 2;
  const height = 350;

  roundedRect(context, x, y, width, height, 54);
  context.fillStyle = 'rgba(5, 18, 40, 0.34)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.lineWidth = 2;
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = 'rgba(255, 255, 255, 0.68)';
  context.font = `700 23px ${FONT_FAMILY}`;
  drawTrackedText(context, 'TELEGRAM, КОТОРЫЙ ТВОЙ', WIDTH / 2, y + 66, 4);
  context.fillStyle = '#FFFFFF';
  context.font = `850 54px ${FONT_FAMILY}`;
  context.fillText('Попробуй bygram', WIDTH / 2, y + 137);
  context.fillStyle = 'rgba(255, 255, 255, 0.72)';
  context.font = `500 28px ${FONT_FAMILY}`;
  context.fillText('Анти-удаление · история правок · свои пузыри', WIDTH / 2, y + 187);

  const pillWidth = 570;
  const pillHeight = 82;
  const pillX = (WIDTH - pillWidth) / 2;
  const pillY = y + 225;
  roundedRect(context, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  context.fillStyle = '#FFFFFF';
  context.shadowColor = 'rgba(2, 14, 34, 0.3)';
  context.shadowBlur = 28;
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = accent;
  context.font = `750 27px ${FONT_FAMILY}`;
  context.fillText(BYGRAM_URL, WIDTH / 2 + 22, pillY + 52);
  context.save();
  context.translate(pillX + 54, pillY + pillHeight / 2);
  context.rotate(-0.25);
  context.fillStyle = accent;
  drawPlane(context, 22);
  context.fill();
  context.restore();
}

function drawGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  context.restore();
}

function drawAppIcon(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
) {
  context.save();
  roundedRect(context, x, y, size, size, 22);
  context.clip();
  if (image) {
    context.drawImage(image, x, y, size, size);
  } else {
    context.fillStyle = '#08090C';
    context.fillRect(x, y, size, size);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `800 34px ${FONT_FAMILY}`;
    context.fillText('by', x + size / 2, y + size / 2 + 2);
  }
  context.restore();
}

function drawUsernamePill(context: CanvasRenderingContext2D, label: string, x: number, y: number) {
  const maxWidth = 330;
  context.font = `700 31px ${FONT_FAMILY}`;
  const textWidth = Math.min(maxWidth - 44, context.measureText(label).width);
  const pillWidth = Math.max(170, textWidth + 44);
  roundedRect(context, x - pillWidth / 2, y - 42, pillWidth, 64, 32);
  context.fillStyle = 'rgba(5, 18, 40, 0.28)';
  context.fill();
  context.fillStyle = '#FFFFFF';
  context.textAlign = 'center';
  context.fillText(label, x, y, maxWidth - 44);
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
) {
  const widths = [...text].map((letter) => context.measureText(letter).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * (text.length - 1);
  let x = centerX - totalWidth / 2;
  context.textAlign = 'left';
  [...text].forEach((letter, index) => {
    context.fillText(letter, x, y);
    x += widths[index] + spacing;
  });
  context.textAlign = 'center';
}

function drawPlane(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.moveTo(-size, size * 0.2);
  context.lineTo(size, -size * 0.72);
  context.lineTo(size * 0.25, size);
  context.lineTo(-size * 0.08, size * 0.23);
  context.closePath();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

async function loadAvatar(user: ApiUser) {
  const hash = getChatAvatarHash(user, 'big');
  if (!hash) return undefined;

  try {
    const url = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
    return await loadImage(url);
  } catch {
    return undefined;
  }
}

async function loadAppIcon() {
  try {
    return await loadImage(new URL('icon-512x512.png', document.baseURI).href);
  } catch {
    return undefined;
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatUserLabel(user: ApiUser) {
  const username = getMainUsername(user);
  return username ? `@${username}` : (getUserFullName(user) || 'Пользователь');
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function pluralizeDays(days: number) {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, MIME_TYPE, JPEG_QUALITY);
  });
}
