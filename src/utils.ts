import type { ReducedTrialRow } from "psyflow-web";

const COLORS = ["RED", "GREEN", "BLUE", "YELLOW"] as const;
const SHAPES = ["CIRCLE", "TRIANGLE", "STAR", "SQUARE"] as const;
const NUMBERS = [1, 2, 3, 4] as const;

const VALID_RULES = new Set(["color", "shape", "number"] as const);

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function toTargetImagePath(color: string, shape: string, number: number): string {
  return `assets/cards/targets/target_color-${color.toLowerCase()}_shape-${shape.toLowerCase()}_number-${number}.png`;
}

export interface CardTrialSpec {
  rule: string;
  condition_id: string;
  target_color: string;
  target_shape: string;
  target_number: number;
  correct_key: string;
  target_image: string;
}

export function normalizeRule(rule: string): "color" | "shape" | "number" {
  const value = String(rule).trim().toLowerCase();
  if (!VALID_RULES.has(value as "color" | "shape" | "number")) {
    throw new Error(`Unsupported sorting rule: ${rule}`);
  }
  return value as "color" | "shape" | "number";
}

export function sampleCardTrialSpec(
  rule: string,
  options: {
    key_list: string[];
    seed: number;
  }
): CardTrialSpec {
  const normalizedRule = normalizeRule(rule);
  const keys = options.key_list.map(String);
  if (keys.length !== 4) {
    throw new Error(`Card sorting requires exactly 4 response keys, got ${JSON.stringify(keys)}`);
  }

  const rng = makeSeededRandom(Math.trunc(options.seed));
  const [colorIndex, shapeIndex, numberIndex] = shuffle([0, 1, 2, 3], rng);
  const correctIndex =
    normalizedRule === "color"
      ? colorIndex
      : normalizedRule === "shape"
        ? shapeIndex
        : numberIndex;
  const targetColor = COLORS[colorIndex];
  const targetShape = SHAPES[shapeIndex];
  const targetNumber = NUMBERS[numberIndex];

  return {
    rule: normalizedRule,
    condition_id: `${normalizedRule}|${targetColor}|${targetShape}|${targetNumber}`,
    target_color: targetColor,
    target_shape: targetShape,
    target_number: targetNumber,
    correct_key: keys[correctIndex],
    target_image: toTargetImagePath(targetColor, targetShape, targetNumber)
  };
}

export function summarizeBlock(
  rows: ReducedTrialRow[],
  blockId: string | null
): { accuracy: number; total_score: number } {
  const blockRows = blockId == null ? rows : rows.filter((row) => row.block_id === blockId);
  if (blockRows.length === 0) {
    return { accuracy: 0, total_score: 0 };
  }
  const correctCount = blockRows.filter((row) => row.card_choice_response_hit === true).length;
  const totalScore = blockRows.reduce((sum, row) => sum + Number(row.choice_feedback_delta ?? 0), 0);
  return {
    accuracy: correctCount / blockRows.length,
    total_score: totalScore
  };
}

export function summarizeTotalScore(rows: ReducedTrialRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.choice_feedback_delta ?? 0), 0);
}
