
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
  is_human: boolean;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
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
