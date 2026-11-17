// Difficulty scale: 1 (easiest) – 100 (hardest), 50 = standard.
export const tweakLabel = (t) => {
    const v = Number(t) || 50;
    if (v === 50) return "50/100 (standard)";
    return v > 50 ? `${v}/100 (harder)` : `${v}/100 (easier)`;
};
export const TWEAK_DEFAULT = 50;
