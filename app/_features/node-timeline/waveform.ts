const MIN_DISPLAY_DB = -40;
const WAVEFORM_BAR_EXPONENT = 1.5;
const MAX_SAMPLES_PER_BAR = 320;

export interface AudioWaveformPeakOptions {
  channels: ArrayLike<number>[];
  barCount: number;
  sampleRate?: number;
  sourceStartSec?: number;
  durationSec?: number;
}

export const getAudioWaveformDisplayFraction = (amplitude: number) => {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return 0;
  const db = 20 * Math.log10(amplitude);
  if (db <= MIN_DISPLAY_DB) return 0;
  return Math.min(1, ((db - MIN_DISPLAY_DB) / -MIN_DISPLAY_DB) ** WAVEFORM_BAR_EXPONENT);
};

export const buildAudioWaveformPeaks = ({
  channels,
  barCount,
  sampleRate,
  sourceStartSec = 0,
  durationSec,
}: AudioWaveformPeakOptions) => {
  const safeBarCount = Math.max(0, Math.floor(barCount));
  if (safeBarCount === 0 || channels.length === 0) return [];

  const totalSamples = Math.max(0, ...channels.map((channel) => channel.length));
  if (totalSamples === 0) return Array.from({ length: safeBarCount }, () => 0);

  const safeSampleRate = Number.isFinite(sampleRate) && Number(sampleRate) > 0 ? Number(sampleRate) : null;
  const sourceStartSample = safeSampleRate ? Math.max(0, Math.floor(Math.max(0, sourceStartSec) * safeSampleRate)) : 0;
  const durationSamples = safeSampleRate && Number.isFinite(durationSec) && Number(durationSec) > 0
    ? Math.ceil(Number(durationSec) * safeSampleRate)
    : totalSamples - sourceStartSample;
  const startSample = Math.min(totalSamples, sourceStartSample);
  const endSample = Math.min(totalSamples, Math.max(startSample, startSample + durationSamples));
  const sampleCount = endSample - startSample;

  if (sampleCount <= 0) return Array.from({ length: safeBarCount }, () => 0);

  return Array.from({ length: safeBarCount }, (_, index) => {
    const bucketStart = startSample + Math.floor((index / safeBarCount) * sampleCount);
    const bucketEnd = Math.min(endSample, startSample + Math.ceil(((index + 1) / safeBarCount) * sampleCount));
    const sampleStride = Math.max(1, Math.floor((bucketEnd - bucketStart) / MAX_SAMPLES_PER_BAR));
    let peak = 0;

    for (let sampleIndex = bucketStart; sampleIndex < bucketEnd; sampleIndex += sampleStride) {
      for (const channel of channels) {
        if (sampleIndex >= channel.length) continue;
        peak = Math.max(peak, Math.abs(Number(channel[sampleIndex]) || 0));
      }
    }

    return getAudioWaveformDisplayFraction(peak);
  });
};
