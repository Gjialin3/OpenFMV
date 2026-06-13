import { roundTimelineTime } from './schema';

export const TIMELINE_RULER_FPS = 30;

export interface TimelineRulerTick {
  time: number;
  label: string | null;
}

const formatTimestamp = (timeInSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(timeInSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

const isSecondBoundary = (timeInSeconds: number) => {
  const frame = Math.round(timeInSeconds * TIMELINE_RULER_FPS);
  return frame % TIMELINE_RULER_FPS === 0;
};

export const formatTimelineRulerLabel = (timeInSeconds: number) => {
  if (isSecondBoundary(timeInSeconds)) return formatTimestamp(timeInSeconds);
  const frame = Math.round(timeInSeconds * TIMELINE_RULER_FPS);
  return `${frame % TIMELINE_RULER_FPS}f`;
};

const getFrameTickConfig = (zoom: number) => {
  if (zoom >= 180) return { labelFrameInterval: 10, tickFrameInterval: 5 };
  if (zoom >= 120) return { labelFrameInterval: 30, tickFrameInterval: 5 };
  if (zoom >= 72) return { labelFrameInterval: 60, tickFrameInterval: 15 };
  if (zoom >= 48) return { labelFrameInterval: 90, tickFrameInterval: 30 };
  if (zoom >= 30) return { labelFrameInterval: 120, tickFrameInterval: 30 };
  return null;
};

const getSecondTickInterval = (zoom: number) => {
  if (zoom >= 24) return 4;
  if (zoom >= 12) return 5;
  return 10;
};

export const getTimelineRulerTicks = ({
  duration,
  zoom,
}: {
  duration: number;
  zoom: number;
}): TimelineRulerTick[] => {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const frameConfig = getFrameTickConfig(zoom);

  if (frameConfig) {
    const durationFrames = Math.max(1, Math.ceil(safeDuration * TIMELINE_RULER_FPS));
    const ticks: TimelineRulerTick[] = [];

    for (let frame = 0; frame <= durationFrames; frame += frameConfig.tickFrameInterval) {
      const shouldLabel = frame % frameConfig.labelFrameInterval === 0;
      const time = roundTimelineTime(frame / TIMELINE_RULER_FPS);
      ticks.push({
        time,
        label: shouldLabel ? formatTimelineRulerLabel(time) : null,
      });
    }

    return ticks;
  }

  const interval = getSecondTickInterval(zoom);
  const ticks: TimelineRulerTick[] = [];
  for (let time = 0; time <= safeDuration + 0.001; time += interval) {
    const safeTime = roundTimelineTime(time);
    ticks.push({ time: safeTime, label: formatTimelineRulerLabel(safeTime) });
  }
  const lastTick = ticks[ticks.length - 1];
  if (!lastTick || lastTick.time !== safeDuration) {
    ticks.push({ time: roundTimelineTime(safeDuration), label: formatTimelineRulerLabel(safeDuration) });
  }
  return ticks;
};
