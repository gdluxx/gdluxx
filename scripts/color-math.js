/** @typedef {[number, number, number]} ColorTriplet */

/** @param {number} value */
function srgbChannelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** @param {number} value */
function linearChannelToSrgb(value) {
  const channel = Math.min(1, Math.max(0, value));
  return 255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);
}

/** @param {ColorTriplet} rgb @returns {ColorTriplet} */
export function srgbToOklab(rgb) {
  const [r, g, b] = rgb.map(srgbChannelToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** @param {ColorTriplet} rgb @returns {ColorTriplet} */
export function srgbToOklch(rgb) {
  const [l, a, b] = srgbToOklab(rgb);
  const chroma = Math.hypot(a, b);
  const hue = chroma < 1e-7 ? Number.NaN : (Math.atan2(b, a) * 180) / Math.PI;
  return [l, chroma, hue < 0 ? hue + 360 : hue];
}

/** @param {ColorTriplet} first @param {ColorTriplet} second */
export function deltaEOk(first, second) {
  const a = srgbToOklab(first);
  const b = srgbToOklab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** @param {ColorTriplet} rgb @returns {ColorTriplet} */
export function grayscaleProjection(rgb) {
  const [r, g, b] = rgb.map(srgbChannelToLinear);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const gray = linearChannelToSrgb(luminance);
  return [gray, gray, gray];
}

const MACHADO_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

/**
 * @param {ColorTriplet} rgb
 * @param {'protanopia' | 'deuteranopia'} deficiency
 * @returns {ColorTriplet}
 */
export function simulateMachado(rgb, deficiency) {
  const linear = rgb.map(srgbChannelToLinear);
  const matrix = MACHADO_MATRICES[deficiency];
  return /** @type {ColorTriplet} */ (
    matrix.map((row) =>
      linearChannelToSrgb(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]),
    )
  );
}
