import type {
  PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent,
} from 'react';
import {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { BygramConstellationDay } from '../../util/bygramConstellation';

import {
  buildBygramConstellationPoints,
} from '../../util/bygramConstellation';

type StarPoint = ReturnType<typeof buildBygramConstellationPoints>[number];

type OwnProps = {
  days: BygramConstellationDay[];
  seed: number;
  selectedDate?: string;
  resetToken: number;
  onSelect: (day?: BygramConstellationDay) => void;
};

type ViewState = {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
};

const BygramConstellationCanvas = ({
  days, seed, selectedDate, resetToken, onSelect,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const points = useMemo(() => buildBygramConstellationPoints(days, seed), [days, seed]);
  const pointsRef = useRef(points);
  const viewRef = useRef<ViewState>({ x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({ moved: false, downAt: 0, pinchDistance: 0, pinchZoom: 1 });

  pointsRef.current = points;

  useEffect(() => {
    const selected = points.find(({ day }) => day.date === selectedDate);
    if (!selected) return;
    const view = viewRef.current;
    view.targetZoom = Math.max(1.16, view.zoom);
    view.targetX = -selected.x * view.targetZoom;
    view.targetY = -selected.y * view.targetZoom;
  }, [points, selectedDate]);

  useEffect(() => {
    const latest = points.at(-1);
    const view = viewRef.current;
    view.targetZoom = 1;
    view.targetX = latest ? -latest.x : 0;
    view.targetY = latest ? -latest.y : 0;
  }, [points, resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let frameId = 0;
    let isActive = true;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = (timestamp: number) => {
      if (!isActive) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const view = viewRef.current;
      const easing = reducedMotion ? 1 : 0.085;
      view.x += (view.targetX - view.x) * easing;
      view.y += (view.targetY - view.y) * easing;
      view.zoom += (view.targetZoom - view.zoom) * easing;
      drawGalaxy(context, pointsRef.current, view, width, height, seed, selectedDate, timestamp, reducedMotion);
      if (!reducedMotion) frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      isActive = false;
      cancelAnimationFrame(frameId);
    };
  }, [seed, selectedDate]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gestureRef.current.moved = false;
    gestureRef.current.downAt = Date.now();
    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      gestureRef.current.pinchDistance = getDistance(first, second);
      gestureRef.current.pinchZoom = viewRef.current.zoom;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);
    const view = viewRef.current;

    if (pointersRef.current.size === 1) {
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) gestureRef.current.moved = true;
      view.x += dx;
      view.y += dy;
      view.targetX = view.x;
      view.targetY = view.y;
    } else {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = getDistance(first, second);
      view.zoom = clamp(gestureRef.current.pinchZoom * distance / gestureRef.current.pinchDistance, 0.55, 2.8);
      view.targetZoom = view.zoom;
      gestureRef.current.moved = true;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const wasTap = !gestureRef.current.moved && Date.now() - gestureRef.current.downAt < 500;
    pointersRef.current.delete(event.pointerId);
    if (wasTap) {
      selectNearestPoint(
        event.clientX, event.clientY, event.currentTarget, points, viewRef.current, onSelect,
      );
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const view = viewRef.current;
    view.targetZoom = clamp(view.targetZoom * Math.exp(-event.deltaY * 0.0015), 0.55, 2.8);
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Созвездие из ${days.length} звёзд — по одной за каждый день общения`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    />
  );
};

function drawGalaxy(
  context: CanvasRenderingContext2D,
  points: StarPoint[],
  view: ViewState,
  width: number,
  height: number,
  seed: number,
  selectedDate: string | undefined,
  timestamp: number,
  reducedMotion: boolean,
) {
  const centerX = width / 2 + view.x;
  const centerY = height / 2 + view.y;
  const time = reducedMotion ? 0 : timestamp * 0.001;
  const hue = 202 + seed % 18;

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 0.55;
  for (let index = 1; index < points.length; index++) {
    const first = points[index - 1];
    const second = points[index];
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (distance > 92) continue;
    context.strokeStyle = `hsla(${hue}, 72%, 76%, ${0.08 * Math.max(0.25, 1 - distance / 92)})`;
    context.beginPath();
    context.moveTo(centerX + first.x * view.zoom, centerY + first.y * view.zoom);
    context.lineTo(centerX + second.x * view.zoom, centerY + second.y * view.zoom);
    context.stroke();
  }

  points.forEach((point) => {
    const x = centerX + point.x * view.zoom;
    const y = centerY + point.y * view.zoom;
    if (x < -30 || y < -30 || x > width + 30 || y > height + 30) return;
    const isSelected = point.day.date === selectedDate;
    const twinkle = reducedMotion ? 1 : 0.9 + Math.sin(time * (0.55 + point.phase * 0.08) + point.phase) * 0.1;
    const radius = point.radius * view.zoom * twinkle * (isSelected ? 1.4 : 1);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * (isSelected ? 6 : 4.2));
    const lightness = 70 + point.day.significance * 18;
    glow.addColorStop(0, `hsla(${hue + point.phase}, 88%, ${lightness}%, 0.96)`);
    glow.addColorStop(0.18, `hsla(${hue}, 82%, 72%, ${0.38 + point.day.significance * 0.2})`);
    glow.addColorStop(1, `hsla(${hue + 6}, 76%, 62%, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius * (isSelected ? 6 : 4.2), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = isSelected ? '#FFFFFF' : `hsla(${hue}, 70%, 92%, 0.96)`;
    context.beginPath();
    context.arc(x, y, Math.max(0.8, radius), 0, Math.PI * 2);
    context.fill();

    if (point.day.planeMilestone || point.day.gifts || point.day.premiumGifted) {
      context.strokeStyle = `hsla(${hue + 12}, 86%, 82%, 0.66)`;
      context.lineWidth = 0.7;
      context.beginPath();
      context.arc(x, y, radius * 2.25, 0, Math.PI * 2);
      context.stroke();
    }
  });
  context.restore();

  if (view.zoom > 1.35) drawMonthLabels(context, points, view, centerX, centerY);
}

function drawMonthLabels(
  context: CanvasRenderingContext2D,
  points: StarPoint[],
  view: ViewState,
  centerX: number,
  centerY: number,
) {
  const seen = new Set<string>();
  context.save();
  context.font = '500 11px system-ui, sans-serif';
  context.fillStyle = 'rgba(220, 235, 255, 0.52)';
  points.forEach((point) => {
    const month = point.day.date.slice(0, 7);
    if (seen.has(month)) return;
    seen.add(month);
    const date = new Date(`${point.day.date}T12:00:00`);
    const label = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
    context.fillText(label, centerX + point.x * view.zoom + 9, centerY + point.y * view.zoom - 7);
  });
  context.restore();
}

function selectNearestPoint(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  points: StarPoint[],
  view: ViewState,
  onSelect: (day?: BygramConstellationDay) => void,
) {
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2 + view.x;
  const centerY = rect.height / 2 + view.y;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let nearest: StarPoint | undefined;
  let nearestDistance = 24;
  points.forEach((point) => {
    const distance = Math.hypot(x - (centerX + point.x * view.zoom), y - (centerY + point.y * view.zoom));
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  });
  onSelect(nearest?.day);
}

function getDistance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default memo(BygramConstellationCanvas);
