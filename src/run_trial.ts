import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialBuilder,
  type TrialSnapshot
} from "psyflow-web";

import { cardConditionToTrialSpec } from "./utils";

function feedbackStimId(snapshot: TrialSnapshot): "feedback_correct" | "feedback_incorrect" {
  return snapshot.units.card_choice_response?.hit === true ? "feedback_correct" : "feedback_incorrect";
}

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    block_id: string;
    block_idx: number;
  }
): TrialBuilder {
  const { settings, stimBank, block_id, block_idx } = context;
  const trialSpec = cardConditionToTrialSpec(String(condition));
  const rule = trialSpec.rule;
  const key_list = ((settings.key_list as string[]) ?? ["1", "2", "3", "4"]).map(String);
  if (key_list.length !== 4) {
    throw new Error(`H000016 requires 4 response keys, got ${JSON.stringify(key_list)}`);
  }
  const trigger_map = (settings.triggers ?? {}) as Record<string, unknown>;
  const trigger = (name: string): number | null => {
    const value = Number(trigger_map[name]);
    return Number.isFinite(value) ? value : null;
  };
  const cueDuration = Number(settings.cue_duration ?? 0.4);
  const anticipationDuration = Number(settings.anticipation_duration ?? 0.2);
  const targetDuration = Number(settings.target_duration ?? 2);
  const feedbackDuration = Number(settings.feedback_duration ?? 0.6);
  const itiDuration = Number(settings.iti_duration ?? 0.3);

  const cueUnit = trial.unit("rule_cue").addStim(stimBank.get(`rule_cue_${rule}`));
  set_trial_context(cueUnit, {
    trial_id: trial.trial_id,
    phase: "rule_cue",
    deadline_s: cueDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition_id,
    task_factors: {
      rule,
      stage: "rule_cue",
      block_idx
    },
    stim_id: `rule_cue_${rule}`
  });
  cueUnit.show({ duration: cueDuration, onset_trigger: trigger(`${rule}_cue_onset`) }).to_dict();

  const preChoiceFixation = trial.unit("pre_choice_fixation").addStim(stimBank.get("fixation"));
  set_trial_context(preChoiceFixation, {
    trial_id: trial.trial_id,
    phase: "pre_choice_fixation",
    deadline_s: anticipationDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition_id,
    task_factors: {
      rule,
      stage: "pre_choice_fixation",
      block_idx
    },
    stim_id: "fixation"
  });
  preChoiceFixation.show({ duration: anticipationDuration, onset_trigger: trigger("anticipation_onset") }).to_dict();

  const choiceDisplay = trial
    .unit("card_choice_response")
    .addStim(stimBank.rebuild("target_card", { image: trialSpec.target_image }))
    .addStim(stimBank.get("ref_card_1"))
    .addStim(stimBank.get("ref_card_2"))
    .addStim(stimBank.get("ref_card_3"))
    .addStim(stimBank.get("ref_card_4"));
  set_trial_context(choiceDisplay, {
    trial_id: trial.trial_id,
    phase: "card_choice_response",
    deadline_s: targetDuration,
    valid_keys: [...key_list],
    block_id,
    condition_id: trialSpec.condition_id,
    task_factors: {
      rule,
      target_color: trialSpec.target_color,
      target_shape: trialSpec.target_shape,
      target_number: trialSpec.target_number,
      correct_key: trialSpec.correct_key,
      target_image: trialSpec.target_image,
      stage: "card_choice_response",
      block_idx
    },
    stim_id: "target_card"
  });
  choiceDisplay
    .captureResponse({
      keys: key_list,
      correct_keys: [trialSpec.correct_key],
      duration: targetDuration,
      onset_trigger: trigger("target_onset"),
      response_trigger: trigger("key_press"),
      timeout_trigger: trigger("no_response"),
      terminate_on_response: true
    })
    .set_state({
      rule,
      condition_id: trialSpec.condition_id,
      target_color: trialSpec.target_color,
      target_shape: trialSpec.target_shape,
      target_number: trialSpec.target_number,
      target_image: trialSpec.target_image,
      target_correct_key: trialSpec.correct_key,
      target_response_key: choiceDisplay.ref<string | null>("response"),
      target_response: choiceDisplay.ref<string | null>("response"),
      target_hit: choiceDisplay.ref<boolean | null>("hit"),
      target_rt: choiceDisplay.ref<number | null>("rt")
    })
    .to_dict();

  const feedbackUnit = trial.unit("choice_feedback").addStim((snapshot: TrialSnapshot) => stimBank.get(feedbackStimId(snapshot)));
  set_trial_context(feedbackUnit, {
    trial_id: trial.trial_id,
    phase: "choice_feedback",
    deadline_s: feedbackDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition_id,
    task_factors: {
      rule,
      correct_key: trialSpec.correct_key,
      response_key: (snapshot: TrialSnapshot) => snapshot.units.card_choice_response?.response ?? null,
      hit: (snapshot: TrialSnapshot) => Boolean(snapshot.units.card_choice_response?.hit),
      stage: "choice_feedback",
      block_idx
    },
    stim_id: (snapshot: TrialSnapshot) => feedbackStimId(snapshot)
  });
  feedbackUnit
    .show({
      duration: feedbackDuration,
      onset_trigger: trigger("feedback_onset")
    })
    .set_state({
      hit: choiceDisplay.ref<boolean>("hit"),
      feedback_label: (snapshot: TrialSnapshot) => (snapshot.units.card_choice_response?.hit === true ? "正确" : "错误"),
      delta: (snapshot: TrialSnapshot) => (snapshot.units.card_choice_response?.hit === true ? 1 : 0)
    })
    .to_dict();

  const itiUnit = trial.unit("iti").addStim(stimBank.get("fixation"));
  set_trial_context(itiUnit, {
    trial_id: trial.trial_id,
    phase: "iti",
    deadline_s: itiDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition_id,
    task_factors: {
      rule,
      stage: "iti",
      block_idx
    },
    stim_id: "fixation"
  });
  itiUnit.show({ duration: itiDuration, onset_trigger: trigger("iti_onset") }).to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const hit = snapshot.units.card_choice_response?.hit === true;
    helpers.setTrialState("rule", rule);
    helpers.setTrialState("condition_id", trialSpec.condition_id);
    helpers.setTrialState("target_correct_key", trialSpec.correct_key);
    helpers.setTrialState("target_response_key", snapshot.units.card_choice_response?.response ?? null);
    helpers.setTrialState("target_response", snapshot.units.card_choice_response?.response ?? null);
    helpers.setTrialState("target_hit", hit);
    helpers.setTrialState("target_rt", snapshot.units.card_choice_response?.rt ?? null);
    helpers.setTrialState("feedback_delta", hit ? 1 : 0);
  });

  return trial;
}
