
export interface GrammarToken {
  text: string;
  type: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'conj' | 'other';
  explanation_vi: string;
}

export interface VocabularyBreakdown {
  term: string;
  type: string; // e.g., "Idiom", "Phrasal Verb", "Noun"
  ipa: string;
  meaning_vi: string;
}

export interface FoodAdditive {
  code: string;
  name: string;
  function: string;
  harmful_effects: string;
  dosage: string;
  metabolism_time: string;
  long_term_risks: string;
}

export interface ExpertAnalysis {
  scientific_en?: string;
  scientific_vi?: string;
  medical_en?: string;
  medical_vi?: string;
  technical_en?: string;
  technical_vi?: string;
  educational_en?: string;
  educational_vi?: string;
  additives?: FoodAdditive[];
  fashion?: {
    style_analysis_en: string;
    style_analysis_vi: string;
    age_group_en: string;
    age_group_vi: string;
    estimated_price_en: string;
    estimated_price_vi: string;
    skin_tone_compatibility_en: string;
    skin_tone_compatibility_vi: string;
  };
}

export interface Exercise {
  type: 'vocabulary' | 'grammar';
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface MainLesson {
  title: string;
  content: string;
}

export interface RecognitionResult {
  en: string;
  ipa: string;
  vi: string;
  example_en: string;
  example_vi: string;
  details_en: string;
  details_vi: string;
  predictions_en?: string;
  predictions_vi?: string;
  grammar_analysis: GrammarToken[];
  vocabulary_breakdown: VocabularyBreakdown[];
  expert_insights?: ExpertAnalysis;
  is_human: boolean;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  exercises: Exercise[];
  main_lessons: MainLesson[];
}

export interface VocabularyItem {
  word: string;
  ipa: string;
  meaning: string;
}

export interface TranslationSuggestion {
  reply_en: string;
  reply_vi: string;
}

export interface FollowUp {
  text_en: string;
  text_vi: string;
}

export interface TranslationResponse {
  original_text: string;
  translated_text: string;
  vocabulary: VocabularyItem[];
  grammar: string;
  suggestions: TranslationSuggestion[];
  follow_up: FollowUp[];
}
