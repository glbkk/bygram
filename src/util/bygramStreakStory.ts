import type { ApiUser } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getChatAvatarHash, getMainUsername, getUserFullName } from '../global/helpers';
import * as mediaLoader from './mediaLoader';

const WIDTH = 1080;
const HEIGHT = 1920;
const MIME_TYPE = 'image/png';

export type BygramStreakStoryTemplate = 'telegram' | 'aurora' | 'midnight';

const PALETTES: Record<BygramStreakStoryTemplate, {
  start: string;
  middle: string;
  end: string;
  accent: string;
  card: string;
}> = {
  telegram: { start: '#168ACD', middle: '#287FC1', end: '#7059C8', accent: '#247DC0', card: '#0A2545' },
  aurora: { start: '#19B7C9', middle: '#4288DA', end: '#8B62D3', accent: '#477DD1', card: '#203C72' },
  midnight: { start: '#0E1621', middle: '#172E47', end: '#35306F', accent: '#58B8F5', card: '#07131F' },
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
  const [currentAvatar, peerAvatar] = await Promise.all([
    loadAvatar(currentUser),
    loadAvatar(peerUser),
  ]);

  drawBrand(context, palette.accent);
  drawTitle(context, days);
  drawUsers(context, currentUser, peerUser, currentAvatar, peerAvatar);
  drawCounter(context, days, palette.accent);
  drawFooter(context);

  const blob = await canvasToBlob(canvas);
  return new File([blob], `bygram-plane-${days}.png`, { type: MIME_TYPE });
}

function drawBackground(context: CanvasRenderingContext2D, palette: typeof PALETTES.telegram) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(0.48, palette.middle);
  gradient.addColorStop(1, palette.end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.globalAlpha = 0.075;
  context.strokeStyle = '#FFFFFF';
  context.lineWidth = 4;
  for (let y = 80; y < HEIGHT; y += 190) {
    for (let x = -80 + (y % 380); x < WIDTH + 120; x += 300) {
      context.save();
      context.translate(x, y);
      context.rotate(-0.34);
      drawPlane(context, 46);
      context.stroke();
      context.restore();
    }
  }
  context.restore();

  context.fillStyle = `${palette.card}38`;
  roundedRect(context, 72, 370, WIDTH - 144, 1110, 64);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.lineWidth = 3;
  context.stroke();
}

function drawBrand(context: CanvasRenderingContext2D, accent: string) {
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255, 255, 255, 0.82)';
  context.font = '600 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('bygram', WIDTH / 2, 205);

  context.beginPath();
  context.arc(WIDTH / 2, 285, 44, 0, Math.PI * 2);
  context.fillStyle = '#FFFFFF';
  context.fill();
  context.save();
  context.translate(WIDTH / 2, 285);
  context.rotate(-0.25);
  context.strokeStyle = accent;
  context.lineWidth = 7;
  drawPlane(context, 48);
  context.stroke();
  context.restore();
}

function drawTitle(context: CanvasRenderingContext2D, days: number) {
  context.textAlign = 'center';
  context.fillStyle = '#FFFFFF';
  context.font = '800 64px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(`У нас уже ${days} ${pluralizeDays(days)}`, WIDTH / 2, 535);
  context.font = '700 58px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('самолётик в bygram!', WIDTH / 2, 610);
}

function drawUsers(
  context: CanvasRenderingContext2D,
  currentUser: ApiUser,
  peerUser: ApiUser,
  currentAvatar?: HTMLImageElement,
  peerAvatar?: HTMLImageElement,
) {
  const leftX = 320;
  const rightX = WIDTH - leftX;
  const avatarY = 905;
  drawAvatar(context, currentUser, currentAvatar, leftX, avatarY);
  drawAvatar(context, peerUser, peerAvatar, rightX, avatarY);

  context.textAlign = 'center';
  context.fillStyle = '#FFFFFF';
  context.font = '700 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(formatUserLabel(currentUser), leftX, 1075, 350);
  context.fillText(formatUserLabel(peerUser), rightX, 1075, 350);
}

function drawAvatar(
  context: CanvasRenderingContext2D,
  user: ApiUser,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
) {
  const radius = 132;
  context.save();
  context.beginPath();
  context.arc(x, y, radius + 12, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.22)';
  context.fill();
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
    context.font = '700 82px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(getInitials(getUserFullName(user) || ''), x, y + 4);
  }
  context.restore();
}

function drawCounter(context: CanvasRenderingContext2D, days: number, accent: string) {
  const x = WIDTH / 2;
  const y = 905;
  context.beginPath();
  context.arc(x, y, 112, 0, Math.PI * 2);
  context.fillStyle = '#FFFFFF';
  context.shadowColor = 'rgba(10, 32, 61, 0.35)';
  context.shadowBlur = 42;
  context.fill();
  context.shadowBlur = 0;

  context.save();
  context.translate(x, y - 30);
  context.rotate(-0.25);
  context.strokeStyle = accent;
  context.lineWidth = 8;
  drawPlane(context, 58);
  context.stroke();
  context.restore();

  context.textAlign = 'center';
  context.fillStyle = accent;
  context.font = '800 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(String(days), x, y + 67);
}

function drawFooter(context: CanvasRenderingContext2D) {
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255, 255, 255, 0.78)';
  context.font = '500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('Общаемся каждый день', WIDTH / 2, 1360);
  context.fillStyle = 'rgba(255, 255, 255, 0.56)';
  context.font = '500 27px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('Серия считается на устройстве', WIDTH / 2, 1410);
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
    }, MIME_TYPE);
  });
}
