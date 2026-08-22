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

export type BygramStreakStoryTemplate = 'telegram' | 'aurora' | 'midnight' | 'editorial' | 'clouds' | 'premium';

type StoryPalette = {
  start: string;
  middle: string;
  end: string;
  accent: string;
  glow: string;
  glowSecondary: string;
  foreground: string;
  secondary: string;
  surface: string;
  surfaceText: string;
  border: string;
  avatarRing: string;
  isLight?: boolean;
  pattern?: 'planes' | 'clouds';
};

const PALETTES: Record<BygramStreakStoryTemplate, StoryPalette> = {
  telegram: {
    start: '#071B33', middle: '#126CA8', end: '#6C4FD3', accent: '#2AABEE', glow: '#57C8FF', glowSecondary: '#A980FF',
    foreground: '#FFFFFF', secondary: 'rgba(255, 255, 255, 0.7)', surface: 'rgba(5, 18, 40, 0.34)',
    surfaceText: '#FFFFFF', border: 'rgba(255, 255, 255, 0.18)',
    avatarRing: 'rgba(255, 255, 255, 0.92)', pattern: 'planes',
  },
  aurora: {
    start: '#073A48', middle: '#167E9A', end: '#7D4EC9', accent: '#53D6E5', glow: '#62F0E2', glowSecondary: '#D88CFF',
    foreground: '#FFFFFF', secondary: 'rgba(255, 255, 255, 0.7)', surface: 'rgba(5, 18, 40, 0.32)',
    surfaceText: '#FFFFFF', border: 'rgba(255, 255, 255, 0.18)',
    avatarRing: 'rgba(255, 255, 255, 0.92)', pattern: 'planes',
  },
  midnight: {
    start: '#050A12', middle: '#102A43', end: '#272052', accent: '#58B8F5', glow: '#2AABEE', glowSecondary: '#826DFF',
    foreground: '#FFFFFF', secondary: 'rgba(255, 255, 255, 0.7)', surface: 'rgba(5, 18, 40, 0.38)',
    surfaceText: '#FFFFFF', border: 'rgba(255, 255, 255, 0.16)',
    avatarRing: 'rgba(255, 255, 255, 0.92)', pattern: 'planes',
  },
  editorial: {
    start: '#F4F4F5', middle: '#F4F4F5', end: '#F4F4F5', accent: '#3390EC', glow: '#FFFFFF', glowSecondary: '#D6EBFA',
    foreground: '#111111', secondary: 'rgba(17, 17, 17, 0.58)', surface: '#FFFFFF', surfaceText: '#111111',
    border: '#D1D1D6', avatarRing: '#FFFFFF', isLight: true,
  },
  clouds: {
    start: '#EAF7FF', middle: '#CBEAFB', end: '#A8D8F4', accent: '#2388D8', glow: '#FFFFFF', glowSecondary: '#8FD1F5',
    foreground: '#17212B', secondary: 'rgba(23, 33, 43, 0.62)', surface: 'rgba(255, 255, 255, 0.78)',
    surfaceText: '#17212B', border: 'rgba(23, 33, 43, 0.1)', avatarRing: '#FFFFFF', isLight: true, pattern: 'clouds',
  },
  premium: {
    start: '#5146C8', middle: '#358EDC', end: '#8A4FD2', accent: '#78D9FF', glow: '#71D4FF', glowSecondary: '#D18CFF',
    foreground: '#FFFFFF', secondary: 'rgba(255, 255, 255, 0.72)', surface: 'rgba(37, 31, 112, 0.3)',
    surfaceText: '#FFFFFF', border: 'rgba(255, 255, 255, 0.2)',
    avatarRing: 'rgba(255, 255, 255, 0.94)', pattern: 'planes',
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
  if (template === 'editorial') {
    const [currentAvatar, peerAvatar, appIcon] = await Promise.all([
      loadAvatar(currentUser),
      loadAvatar(peerUser),
      loadAppIcon(),
    ]);
    drawEditorialStory(context, currentUser, peerUser, currentAvatar, peerAvatar, appIcon, days, palette);
    const blob = await canvasToBlob(canvas);
    return new File([blob], `bygram-plane-${days}.jpg`, { type: MIME_TYPE });
  }

  drawBackground(context, palette);
  const [currentAvatar, peerAvatar, appIcon] = await Promise.all([
    loadAvatar(currentUser),
    loadAvatar(peerUser),
    loadAppIcon(),
  ]);

  drawBrand(context, appIcon, palette.foreground);
  drawTitle(context, days, palette);
  drawUsers(context, currentUser, peerUser, currentAvatar, peerAvatar, palette);
  drawFooter(context, palette);

  const blob = await canvasToBlob(canvas);
  return new File([blob], `bygram-plane-${days}.jpg`, { type: MIME_TYPE });
}

function drawEditorialStory(
  context: CanvasRenderingContext2D,
  currentUser: ApiUser,
  peerUser: ApiUser,
  currentAvatar: HTMLImageElement | undefined,
  peerAvatar: HTMLImageElement | undefined,
  appIcon: HTMLImageElement | undefined,
  days: number,
  palette: StoryPalette,
) {
  context.fillStyle = palette.start;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = palette.accent;
  context.fillRect(0, 0, WIDTH, 12);

  drawAppIcon(context, appIcon, 78, 104, 64);
  context.fillStyle = palette.foreground;
  context.textAlign = 'left';
  context.font = `750 38px ${FONT_FAMILY}`;
  context.fillText('bygram', 160, 149);

  context.font = `700 76px ${FONT_FAMILY}`;
  context.fillText(`У нас уже ${days} ${pluralizeDays(days)}`, 78, 380, 924);
  context.fillStyle = palette.accent;
  context.fillText('самолётик', 78, 468);
  const accentWidth = context.measureText('самолётик').width;
  context.fillStyle = palette.foreground;
  context.fillText(' в bygram!', 78 + accentWidth, 468, 924 - accentWidth);

  drawEditorialUserCard(context, currentUser, currentAvatar, 304, 930, -0.052, '01');
  drawEditorialUserCard(context, peerUser, peerAvatar, 776, 995, 0.052, '02');
  drawPlaneBadge(context, WIDTH / 2, 1010, palette);

  const ruleY = 1395;
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(78, ruleY);
  context.lineTo(WIDTH - 78, ruleY);
  context.stroke();
  context.fillStyle = palette.accent;
  context.textAlign = 'center';
  context.font = `700 25px ${FONT_FAMILY}`;
  drawTrackedText(context, `${days} ${pluralizeDays(days).toUpperCase()} ПОДРЯД`, WIDTH / 2, ruleY + 61, 3);
  context.beginPath();
  context.moveTo(78, ruleY + 92);
  context.lineTo(WIDTH - 78, ruleY + 92);
  context.stroke();

  context.fillStyle = palette.accent;
  context.font = `650 28px ${FONT_FAMILY}`;
  context.fillText(BYGRAM_URL, WIDTH / 2, 1778);
}

function drawEditorialUserCard(
  context: CanvasRenderingContext2D,
  user: ApiUser,
  image: HTMLImageElement | undefined,
  centerX: number,
  centerY: number,
  rotation: number,
  ordinal: string,
) {
  const width = 438;
  const height = 548;
  const imageX = -194;
  const imageY = -244;
  const imageWidth = 388;
  const imageHeight = 382;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  context.shadowColor = 'rgba(23, 33, 43, 0.17)';
  context.shadowBlur = 42;
  context.shadowOffsetY = 18;
  roundedRect(context, -width / 2, -height / 2, width, height, 30);
  context.fillStyle = '#FFFFFF';
  context.fill();
  context.shadowColor = 'transparent';

  context.save();
  roundedRect(context, imageX, imageY, imageWidth, imageHeight, 22);
  context.clip();
  if (image) {
    const scale = Math.max(imageWidth / image.naturalWidth, imageHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, -drawWidth / 2, imageY + (imageHeight - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    const gradient = context.createLinearGradient(imageX, imageY, imageX + imageWidth, imageY + imageHeight);
    gradient.addColorStop(0, '#75B8EC');
    gradient.addColorStop(1, '#8876DD');
    context.fillStyle = gradient;
    context.fillRect(imageX, imageY, imageWidth, imageHeight);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `700 112px ${FONT_FAMILY}`;
    context.fillText(getInitials(getUserFullName(user) || ''), 0, imageY + imageHeight / 2 + 4);
  }
  context.restore();

  context.fillStyle = '#111111';
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.font = `650 31px ${FONT_FAMILY}`;
  context.fillText(formatUserLabel(user), imageX, 205, 320);
  context.textAlign = 'right';
  context.font = `700 17px ${FONT_FAMILY}`;
  context.fillText(ordinal, imageX + imageWidth, 205);
  context.restore();
}

function drawCloudPattern(context: CanvasRenderingContext2D, color: string) {
  const clouds = [
    [120, 300, 170], [930, 470, 250], [220, 1460, 230], [850, 1650, 180],
  ];
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.2)';
  context.strokeStyle = color;
  context.globalAlpha = 0.18;
  context.lineWidth = 3;
  clouds.forEach(([x, y, radius]) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D, palette: StoryPalette) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(0.48, palette.middle);
  gradient.addColorStop(1, palette.end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawGlow(context, 150, 360, 520, palette.glow, 0.34);
  drawGlow(context, 950, 720, 620, palette.glowSecondary, 0.3);
  drawGlow(context, 460, 1630, 700, palette.glow, 0.16);

  if (palette.pattern === 'clouds') {
    drawCloudPattern(context, palette.accent);
  } else if (palette.pattern === 'planes') {
    context.save();
    context.globalAlpha = 0.065;
    context.strokeStyle = palette.foreground;
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
  }

  roundedRect(context, 48, 48, WIDTH - 96, HEIGHT - 96, 76);
  context.fillStyle = palette.isLight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(4, 16, 35, 0.14)';
  context.fill();
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.stroke();
}

function drawBrand(context: CanvasRenderingContext2D, appIcon: HTMLImageElement | undefined, color: string) {
  const iconSize = 82;
  const iconX = 386;
  const iconY = 185;
  drawAppIcon(context, appIcon, iconX, iconY, iconSize);

  context.textAlign = 'left';
  context.fillStyle = color;
  context.font = `800 44px ${FONT_FAMILY}`;
  context.fillText('bygram', iconX + iconSize + 24, iconY + 55);
}

function drawTitle(context: CanvasRenderingContext2D, days: number, palette: StoryPalette) {
  context.textAlign = 'center';
  context.fillStyle = palette.secondary;
  context.font = `700 31px ${FONT_FAMILY}`;
  drawTrackedText(context, 'У НАС УЖЕ', WIDTH / 2, 365, 8);

  const daysText = String(days);
  const numberSize = daysText.length >= 5 ? 180 : daysText.length >= 4 ? 208 : 244;
  context.fillStyle = palette.foreground;
  context.font = `900 ${numberSize}px ${FONT_FAMILY}`;
  context.shadowColor = palette.isLight ? 'rgba(51, 144, 236, 0.12)' : 'rgba(3, 19, 44, 0.24)';
  context.shadowBlur = 30;
  context.fillText(daysText, WIDTH / 2, 600, 860);
  context.shadowBlur = 0;

  context.fillStyle = palette.foreground;
  context.font = `800 50px ${FONT_FAMILY}`;
  context.fillText(`${pluralizeDays(days)} самолётик в bygram!`, WIDTH / 2, 680, 900);
}

function drawUsers(
  context: CanvasRenderingContext2D,
  currentUser: ApiUser,
  peerUser: ApiUser,
  currentAvatar: HTMLImageElement | undefined,
  peerAvatar: HTMLImageElement | undefined,
  palette: StoryPalette,
) {
  const leftX = 326;
  const rightX = WIDTH - leftX;
  const avatarY = 970;

  context.save();
  context.strokeStyle = palette.isLight ? 'rgba(51, 144, 236, 0.3)' : 'rgba(255, 255, 255, 0.34)';
  context.lineWidth = 5;
  context.setLineDash([12, 18]);
  context.beginPath();
  context.moveTo(leftX + 155, avatarY);
  context.bezierCurveTo(500, avatarY - 50, 580, avatarY + 50, rightX - 155, avatarY);
  context.stroke();
  context.restore();

  drawAvatar(context, currentUser, currentAvatar, leftX, avatarY, palette.avatarRing);
  drawAvatar(context, peerUser, peerAvatar, rightX, avatarY, palette.avatarRing);
  drawPlaneBadge(context, WIDTH / 2, avatarY, palette);

  context.textAlign = 'center';
  context.fillStyle = palette.foreground;
  drawUsernamePill(context, formatUserLabel(currentUser), leftX, 1165, palette);
  drawUsernamePill(context, formatUserLabel(peerUser), rightX, 1165, palette);
}

function drawAvatar(
  context: CanvasRenderingContext2D,
  user: ApiUser,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  ringColor = 'rgba(255, 255, 255, 0.92)',
) {
  const radius = 142;
  context.save();
  context.shadowColor = 'rgba(4, 17, 40, 0.36)';
  context.shadowBlur = 34;
  context.beginPath();
  context.arc(x, y, radius + 11, 0, Math.PI * 2);
  context.fillStyle = ringColor;
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

function drawPlaneBadge(context: CanvasRenderingContext2D, x: number, y: number, palette: StoryPalette) {
  context.beginPath();
  context.arc(x, y, 86, 0, Math.PI * 2);
  context.fillStyle = palette.isLight ? '#FFFFFF' : palette.foreground;
  context.shadowColor = 'rgba(4, 17, 40, 0.42)';
  context.shadowBlur = 36;
  context.fill();
  context.shadowBlur = 0;

  context.save();
  context.translate(x, y);
  context.rotate(-0.25);
  context.fillStyle = palette.accent;
  drawPlane(context, 43);
  context.fill();
  context.restore();
}

function drawFooter(context: CanvasRenderingContext2D, palette: StoryPalette) {
  const y = 1580;
  const pillWidth = 570;
  const pillHeight = 82;
  const pillX = (WIDTH - pillWidth) / 2;
  const pillY = y;
  roundedRect(context, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  context.fillStyle = palette.isLight ? 'rgba(255, 255, 255, 0.88)' : palette.surface;
  context.shadowColor = 'rgba(2, 14, 34, 0.3)';
  context.shadowBlur = palette.isLight ? 16 : 28;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.stroke();
  context.textAlign = 'center';
  context.fillStyle = palette.accent;
  context.font = `750 27px ${FONT_FAMILY}`;
  context.fillText(BYGRAM_URL, WIDTH / 2 + 22, pillY + 52);
  context.save();
  context.translate(pillX + 54, pillY + pillHeight / 2);
  context.rotate(-0.25);
  context.fillStyle = palette.accent;
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

function drawUsernamePill(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  palette: StoryPalette,
) {
  const maxWidth = 330;
  context.font = `700 31px ${FONT_FAMILY}`;
  const textWidth = Math.min(maxWidth - 44, context.measureText(label).width);
  const pillWidth = Math.max(170, textWidth + 44);
  roundedRect(context, x - pillWidth / 2, y - 42, pillWidth, 64, 32);
  context.fillStyle = palette.surface;
  context.fill();
  context.strokeStyle = palette.border;
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = palette.surfaceText;
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
