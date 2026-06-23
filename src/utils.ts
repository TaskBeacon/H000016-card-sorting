import { PythonRandom, type ReducedTrialRow } from "psyflow-web";

const COLORS = ["RED", "GREEN", "BLUE", "YELLOW"] as const;
const SHAPES = ["CIRCLE", "TRIANGLE", "STAR", "SQUARE"] as const;
const NUMBERS = [1, 2, 3, 4] as const;

const VALID_RULES = new Set(["color", "shape", "number"] as const);

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

type EncodedCardTrialSpec = CardTrialSpec & { kind: "card_sorting_trial" };

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

  const rng = new PythonRandom(Math.trunc(options.seed));
  const [colorIndex, shapeIndex, numberIndex] = rng.shuffle([0, 1, 2, 3]);
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

export function encodeCardTrialSpec(spec: CardTrialSpec): string {
  return JSON.stringify({
    kind: "card_sorting_trial",
    ...spec
  } satisfies EncodedCardTrialSpec);
}

export function cardConditionToTrialSpec(condition: string): CardTrialSpec {
  const value = String(condition);
  if (value.trim().startsWith("{")) {
    const parsed = JSON.parse(value) as Partial<EncodedCardTrialSpec>;
    if (parsed.kind === "card_sorting_trial") {
      return {
        rule: normalizeRule(String(parsed.rule)),
        condition_id: String(parsed.condition_id),
        target_color: String(parsed.target_color),
        target_shape: String(parsed.target_shape),
        target_number: Number(parsed.target_number),
        correct_key: String(parsed.correct_key),
        target_image: String(parsed.target_image)
      };
    }
  }
  return sampleCardTrialSpec(value, {
    key_list: ["1", "2", "3", "4"],
    seed: 0
  });
}

export function generateCardSortingConditions(
  nTrials: number,
  conditionLabels: string[] = ["color", "shape", "number"],
  options: {
    seed?: number;
    key_list?: string[];
  } = {}
): string[] {
  const labels = conditionLabels.map((label) => normalizeRule(String(label)));
  if (labels.length === 0) {
    throw new Error("Card sorting condition labels cannot be empty.");
  }
  const keys = (options.key_list ?? ["1", "2", "3", "4"]).map(String);
  if (keys.length !== 4) {
    throw new Error(`Card sorting requires exactly 4 response keys, got ${JSON.stringify(keys)}`);
  }

  const rng = new PythonRandom(Math.trunc(options.seed ?? 0));
  const ruleSchedule: string[] = [];
  while (ruleSchedule.length < Math.trunc(nTrials)) {
    ruleSchedule.push(...labels);
  }
  const scheduledRules = ruleSchedule.slice(0, Math.trunc(nTrials));
  if (labels.length > 1) {
    rng.shuffle(scheduledRules);
  }

  return scheduledRules.map((rule) => {
    const trialSeed = 1 + rng.randBelow(2 ** 31 - 1);
    return encodeCardTrialSpec(
      sampleCardTrialSpec(rule, {
        key_list: keys,
        seed: trialSeed
      })
    );
  });
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
