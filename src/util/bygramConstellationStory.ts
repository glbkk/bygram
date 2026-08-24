import type { ApiUser } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getChatAvatarHash, getMainUsername, getUserFullName } from '../global/helpers';
import {
  buildBygramConstellationPoints,
  type BygramConstellationDay,
} from './bygramConstellation';
import * as mediaLoader from './mediaLoader';

const WIDTH = 1080;
const HEIGHT = 1920;
const MIME_TYPE = 'image/jpeg';
const JPEG_QUALITY = 0.96;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BYGRAM_URL = 'glbkk.github.io/bygram';

export async function createBygramConstellationStoryFile(
  currentUser: ApiUser,
  peerUser: ApiUser,
  days: BygramConstellationDay[],
  seed: number,
) {
  if (!days.length) throw new Error('Constellation is empty');

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  const [currentAvatar, peerAvatar, appIcon] = await Promise.all([
    loadAvatar(currentUser),
    loadAvatar(peerUser),
    loadAppIcon(),
  ]);

  drawBackground(context);
  drawBrand(context, appIcon);
  drawConstellation(context, days, seed);
  drawOwners(context, currentUser, peerUser, currentAvatar, peerAvatar);
  drawFooter(context);

  const blob = await canvasToBlob(canvas);
  return new File([blob], `bygram-constellation-${days.length}.jpg`, { type: MIME_TYPE });
}

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = '#17212B';
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 52; y < HEIGHT; y += 52) {
    for (let x = 42 + (y / 52 % 2) * 24; x < WIDTH; x += 64) {
      context.beginPath();
      context.arc(x, y, 1.25, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawBrand(context: CanvasRenderingContext2D, appIcon?: HTMLImageElement) {
  drawAppIcon(context, appIcon, 72, 92, 88);
  context.textAlign = 'left';
  context.fillStyle = '#FFFFFF';
  context.font = `750 50px ${FONT_FAMILY}`;
  context.fillText('bygram', 184, 145);
  context.fillStyle = 'rgba(255, 255, 255, 0.58)';
  context.font = `500 30px ${FONT_FAMILY}`;
  context.fillText('Наше созвездие', 184, 187);
}

function drawConstellation(
  context: CanvasRenderingContext2D,
  days: BygramConstellationDay[],
  seed: number,
) {
  const panel = { x: 54, y: 258, width: 972, height: 1372 };
  roundedRect(context, panel.x, panel.y, panel.width, panel.height, 46);
  context.fillStyle = '#0E1621';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.075)';
  context.lineWidth = 2;
  context.stroke();

  context.save();
  roundedRect(context, panel.x, panel.y, panel.width, panel.height, 46);
  context.clip();

  const points = buildBygramConstellationPoints(days, seed);
  const field = { x: 106, y: 400, width: 868, height: 1110 };
  const rawBounds = getBounds(points);
  const rawSpanX = Math.max(36, rawBounds.maxX - rawBounds.minX);
  const rawSpanY = Math.max(36, rawBounds.maxY - rawBounds.minY);
  const normalFit = Math.min(field.width / rawSpanX, field.height / rawSpanY);
  const rotatedFit = Math.min(field.width / rawSpanY, field.height / rawSpanX);
  const shouldRotate = rotatedFit > normalFit * 1.06;
  const projected = points.map((point) => ({
    point,
    x: shouldRotate ? -point.y : point.x,
    y: shouldRotate ? point.x : point.y,
  }));
  const bounds = getBounds(projected);
  const spanX = Math.max(36, bounds.maxX - bounds.minX);
  const spanY = Math.max(36, bounds.maxY - bounds.minY);
  const scale = Math.min(field.width / spanX, field.height / spanY, 12) * 0.88;
  const sourceCenterX = (bounds.minX + bounds.maxX) / 2;
  const sourceCenterY = (bounds.minY + bounds.maxY) / 2;
  const centerX = field.x + field.width / 2;
  const centerY = field.y + field.height / 2 + 24;
  const hue = 202 + seed % 18;

  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 1.5;
  for (let index = 1; index < projected.length; index++) {
    const first = projected[index - 1];
    const second = projected[index];
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (distance > 92) continue;
    context.strokeStyle = `hsla(${hue}, 72%, 74%, ${0.13 * Math.max(0.3, 1 - distance / 92)})`;
    context.beginPath();
    context.moveTo(centerX + (first.x - sourceCenterX) * scale, centerY + (first.y - sourceCenterY) * scale);
    context.lineTo(centerX + (second.x - sourceCenterX) * scale, centerY + (second.y - sourceCenterY) * scale);
    context.stroke();
  }

  projected.forEach(({ point, x: projectedX, y: projectedY }) => {
    const x = centerX + (projectedX - sourceCenterX) * scale;
    const y = centerY + (projectedY - sourceCenterY) * scale;
    const radius = Math.max(2.8, Math.min(10.5, point.radius * Math.sqrt(scale) * 0.88));
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 5);
    glow.addColorStop(0, `hsla(${hue}, 88%, 86%, 0.95)`);
    glow.addColorStop(0.2, `hsla(${hue}, 82%, 68%, ${0.38 + point.day.significance * 0.24})`);
    glow.addColorStop(1, `hsla(${hue + 7}, 74%, 58%, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius * 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#F4FAFF';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    if (point.day.planeMilestone || point.day.gifts || point.day.premiumGifted) {
      context.strokeStyle = `hsla(${hue + 12}, 86%, 82%, 0.68)`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(x, y, radius * 2.3, 0, Math.PI * 2);
      context.stroke();
    }
  });
  context.restore();

  context.textAlign = 'left';
  context.fillStyle = '#FFFFFF';
  context.font = `650 34px ${FONT_FAMILY}`;
  context.fillText(`${days.length} ${pluralizeStars(days.length)}`, 94, 322);
  context.fillStyle = 'rgba(255, 255, 255, 0.48)';
  context.font = `500 25px ${FONT_FAMILY}`;
  context.fillText(formatRange(days), 94, 361);
}

function drawOwners(
  context: CanvasRenderingContext2D,
  currentUser: ApiUser,
  peerUser: ApiUser,
  currentAvatar?: HTMLImageElement,
  peerAvatar?: HTMLImageElement,
) {
  const x = 600;
  const y = 278;
  const width = 384;
  const height = 112;
  roundedRect(context, x, y, width, height, 56);
  context.fillStyle = '#17212B';
  context.fill();

  drawSmallAvatar(context, currentUser, currentAvatar, x + 57, y + 56, 41);
  drawSmallAvatar(context, peerUser, peerAvatar, x + 108, y + 56, 41);

  context.textAlign = 'left';
  context.fillStyle = '#FFFFFF';
  context.font = `600 25px ${FONT_FAMILY}`;
  context.fillText(formatUserLabel(currentUser), x + 166, y + 46, 194);
  context.fillStyle = 'rgba(255, 255, 255, 0.58)';
  context.font = `500 23px ${FONT_FAMILY}`;
  context.fillText(formatUserLabel(peerUser), x + 166, y + 79, 194);
}

function drawFooter(context: CanvasRenderingContext2D) {
  context.textAlign = 'center';
  context.fillStyle = '#3390EC';
  context.font = `650 36px ${FONT_FAMILY}`;
  context.fillText(BYGRAM_URL, WIDTH / 2, 1788);
}

function drawSmallAvatar(
  context: CanvasRenderingContext2D,
  user: ApiUser,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  radius: number,
) {
  context.save();
  context.beginPath();
  context.arc(x, y, radius + 3, 0, Math.PI * 2);
  context.fillStyle = '#17212B';
  context.fill();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  if (image) {
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - sourceSize) / 2,
      (image.naturalHeight - sourceSize) / 2,
      sourceSize,
      sourceSize,
      x - radius,
      y - radius,
      radius * 2,
      radius * 2,
    );
  } else {
    context.fillStyle = '#3390EC';
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `700 ${radius}px ${FONT_FAMILY}`;
    context.fillText(getInitials(getUserFullName(user) || ''), x, y + 1);
  }
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
  roundedRect(context, x, y, size, size, size * 0.23);
  context.clip();
  if (image) context.drawImage(image, x, y, size, size);
  else {
    context.fillStyle = '#050505';
    context.fillRect(x, y, size, size);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `750 ${size * 0.42}px ${FONT_FAMILY}`;
    context.fillText('by', x + size / 2, y + size / 2 + 1);
  }
  context.restore();
}

function getBounds(points: Array<{ x: number; y: number }>) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function formatRange(days: BygramConstellationDay[]) {
  const first = new Date(`${days[0].date}T12:00:00`);
  const last = new Date(`${days.at(-1)!.date}T12:00:00`);
  const format = (date: Date) => date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  return first.getTime() === last.getTime() ? format(first) : `${format(first)} — ${format(last)}`;
}

function pluralizeStars(value: number) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'звёзд';
  if (mod10 === 1) return 'звезда';
  if (mod10 >= 2 && mod10 <= 4) return 'звезды';
  return 'звёзд';
}

async function loadAvatar(user: ApiUser) {
  const hash = getChatAvatarHash(user, 'big');
  if (!hash) return undefined;
  try {
    return await loadImage(await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl));
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

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, MIME_TYPE, JPEG_QUALITY);
  });
}
