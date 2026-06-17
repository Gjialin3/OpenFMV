import type { CSSProperties } from 'react';

import {
  ButtonMode,
  ButtonStyleBackgroundFit,
  ButtonStyleConfig,
  ButtonStylePreset,
  ButtonStyleShadow,
  ButtonStyleShape,
  TimelineInteractionClip,
} from '@/app/_types';
import { resolveMediaSrc } from '@/app/_utils/mediaSrc';

export const BUTTON_STYLE_PRESETS: ButtonStylePreset[] = ['solid', 'outline', 'glass', 'ghost'];
export const BUTTON_STYLE_SHAPES: ButtonStyleShape[] = ['rounded', 'pill', 'square', 'oval', 'diamond', 'hexagon'];
export const BUTTON_STYLE_SHADOWS: ButtonStyleShadow[] = ['none', 'soft', 'strong'];
export const BUTTON_STYLE_BACKGROUND_FITS: ButtonStyleBackgroundFit[] = ['cover', 'contain', 'stretch'];

export type ResolvedButtonStyleConfig = Required<Omit<ButtonStyleConfig, 'backgroundImageAssetId' | 'backgroundImageSrc' | 'backgroundImageFit'>> & {
  backgroundImageAssetId: string | undefined;
  backgroundImageSrc: string | undefined;
  backgroundImageFit: ButtonStyleBackgroundFit;
};

export const BUTTON_STYLE_SWATCHES = [
  '#f97316',
  '#06b6d4',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#facc15',
  '#ffffff',
  '#111827',
];

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

const clamp01 = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(1, numberValue));
};

export const clampButtonStyleOpacity = (value: unknown, fallback = 1) => clamp01(value, fallback);

export const clampButtonBorderWidth = (value: unknown, fallback = 1) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(4, Math.round(numberValue)));
};

export const normalizeButtonHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(HEX_COLOR_PATTERN);
  if (!match) return fallback;
  const color = match[1];
  if (color.length === 3) {
    return `#${color[0]}${color[0]}${color[1]}${color[1]}${color[2]}${color[2]}`.toLowerCase();
  }
  return `#${color}`.toLowerCase();
};

const isButtonStylePreset = (value: unknown): value is ButtonStylePreset => (
  value === 'solid' || value === 'outline' || value === 'glass' || value === 'ghost'
);

const isButtonStyleShape = (value: unknown): value is ButtonStyleShape => (
  BUTTON_STYLE_SHAPES.includes(value as ButtonStyleShape)
);

const isButtonStyleShadow = (value: unknown): value is ButtonStyleShadow => (
  value === 'none' || value === 'soft' || value === 'strong'
);

const isButtonStyleBackgroundFit = (value: unknown): value is ButtonStyleBackgroundFit => (
  BUTTON_STYLE_BACKGROUND_FITS.includes(value as ButtonStyleBackgroundFit)
);

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const getButtonStylePresetDefaults = (preset: ButtonStylePreset): Pick<ButtonStyleConfig, 'fillOpacity' | 'borderOpacity' | 'borderWidth' | 'shadow'> => {
  if (preset === 'outline') return { fillOpacity: 0, borderOpacity: 0.9, borderWidth: 1, shadow: 'soft' };
  if (preset === 'glass') return { fillOpacity: 0.2, borderOpacity: 0.38, borderWidth: 1, shadow: 'soft' };
  if (preset === 'ghost') return { fillOpacity: 0, borderOpacity: 0, borderWidth: 0, shadow: 'none' };
  return { fillOpacity: 0.92, borderOpacity: 0.9, borderWidth: 1, shadow: 'strong' };
};

export const getDefaultButtonStyleConfig = (mode?: ButtonMode): ResolvedButtonStyleConfig => {
  const preset: ButtonStylePreset = 'solid';
  const presetDefaults = getButtonStylePresetDefaults(preset);
  const isQte = mode === 'qte';
  return {
    preset,
    shape: 'rounded',
    fillColor: isQte ? '#06b6d4' : '#f97316',
    textColor: '#ffffff',
    borderColor: isQte ? '#a5f3fc' : '#fed7aa',
    fillOpacity: presetDefaults.fillOpacity ?? 0.92,
    borderOpacity: presetDefaults.borderOpacity ?? 0.9,
    borderWidth: presetDefaults.borderWidth ?? 1,
    shadow: presetDefaults.shadow ?? 'strong',
    backgroundImageAssetId: undefined,
    backgroundImageSrc: undefined,
    backgroundImageFit: 'cover',
  };
};

export const normalizeButtonStyleConfig = (value: unknown, mode?: ButtonMode): ButtonStyleConfig | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const modeDefaults = getDefaultButtonStyleConfig(mode);
  const preset = isButtonStylePreset(source.preset) ? source.preset : modeDefaults.preset;
  const presetDefaults = getButtonStylePresetDefaults(preset);
  return {
    preset,
    shape: isButtonStyleShape(source.shape) ? source.shape : modeDefaults.shape,
    fillColor: normalizeButtonHexColor(source.fillColor, modeDefaults.fillColor),
    textColor: normalizeButtonHexColor(source.textColor, modeDefaults.textColor),
    borderColor: normalizeButtonHexColor(source.borderColor, modeDefaults.borderColor),
    fillOpacity: clampButtonStyleOpacity(source.fillOpacity, presetDefaults.fillOpacity ?? modeDefaults.fillOpacity),
    borderOpacity: clampButtonStyleOpacity(source.borderOpacity, presetDefaults.borderOpacity ?? modeDefaults.borderOpacity),
    borderWidth: clampButtonBorderWidth(source.borderWidth, presetDefaults.borderWidth ?? modeDefaults.borderWidth),
    shadow: isButtonStyleShadow(source.shadow) ? source.shadow : presetDefaults.shadow ?? modeDefaults.shadow,
    backgroundImageAssetId: normalizeOptionalString(source.backgroundImageAssetId),
    backgroundImageSrc: normalizeOptionalString(source.backgroundImageSrc),
    backgroundImageFit: isButtonStyleBackgroundFit(source.backgroundImageFit) ? source.backgroundImageFit : modeDefaults.backgroundImageFit,
  };
};

export const resolveButtonStyleConfig = (clip: Pick<TimelineInteractionClip, 'mode' | 'style'>): ResolvedButtonStyleConfig => {
  return {
    ...getDefaultButtonStyleConfig(clip.mode === 'qte' ? 'qte' : 'normal'),
    ...normalizeButtonStyleConfig(clip.style, clip.mode === 'qte' ? 'qte' : 'normal'),
  };
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeButtonHexColor(hex, '#000000').slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

export const getButtonStyleRgba = (hex: string, opacity: number) => {
  const color = hexToRgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clampButtonStyleOpacity(opacity)})`;
};

export const getButtonStyleRadius = (shape: ButtonStyleShape) => {
  if (shape === 'oval') return '50%';
  if (shape === 'diamond' || shape === 'hexagon') return '2px';
  if (shape === 'pill') return '999px';
  if (shape === 'square') return '2px';
  return '10px';
};

export const getButtonStyleClipPath = (shape: ButtonStyleShape) => {
  if (shape === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shape === 'hexagon') return 'polygon(18% 0%, 82% 0%, 100% 50%, 82% 100%, 18% 100%, 0% 50%)';
  return undefined;
};

export const getButtonStyleShadow = (shadow: ButtonStyleShadow) => {
  if (shadow === 'strong') return '0 18px 52px rgba(0, 0, 0, 0.38)';
  if (shadow === 'soft') return '0 10px 30px rgba(0, 0, 0, 0.24)';
  return 'none';
};

export const getButtonStyleBackgroundSize = (fit?: ButtonStyleBackgroundFit) => {
  if (fit === 'contain') return 'contain';
  if (fit === 'stretch') return '100% 100%';
  return 'cover';
};

const escapeCssUrl = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '');

export const getButtonClipInlineStyle = (clip: Pick<TimelineInteractionClip, 'mode' | 'style'>): CSSProperties => {
  const style = resolveButtonStyleConfig(clip);
  const clipPath = getButtonStyleClipPath(style.shape);
  const backgroundImageSrc = resolveMediaSrc(style.backgroundImageSrc);
  return {
    backgroundColor: getButtonStyleRgba(style.fillColor, style.fillOpacity),
    backgroundImage: backgroundImageSrc ? `url("${escapeCssUrl(backgroundImageSrc)}")` : undefined,
    backgroundPosition: backgroundImageSrc ? 'center' : undefined,
    backgroundRepeat: backgroundImageSrc ? 'no-repeat' : undefined,
    backgroundSize: backgroundImageSrc ? getButtonStyleBackgroundSize(style.backgroundImageFit) : undefined,
    borderColor: getButtonStyleRgba(style.borderColor, style.borderWidth > 0 ? style.borderOpacity : 0),
    borderStyle: 'solid',
    borderWidth: style.borderWidth,
    borderRadius: getButtonStyleRadius(style.shape),
    clipPath,
    WebkitClipPath: clipPath,
    boxShadow: getButtonStyleShadow(style.shadow),
    color: style.textColor,
    backdropFilter: style.preset === 'glass' ? 'blur(18px)' : undefined,
  };
};
