
import { GoogleGenAI, Type } from "@google/genai";
import { RecognitionResult, TranslationResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const identifyObject = async (base64Image: string): Promise<RecognitionResult> => {
  const base64Data = base64Image.split(',')[1] || base64Image;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: `Phân tích đối tượng trong khung hình cực kỳ chi tiết. 
          YÊU CẦU:
          1. Tên (EN+IPA+VI).
          2. Mô tả ngoại hình (với người: tả kỹ tóc, trang phục/họa tiết, cân nặng, cảm xúc).
          3. Dự đoán (nghề nghiệp, tình cảm - chỉ với người).
          4. PHÂN TÍCH NGỮ PHÁP: Chia câu ví dụ 'example_en' thành các thành phần: Noun, Verb, Adj, Adv, Prep, Pron, Conj.
          5. PHÂN TÍCH TỪ VỰNG: Liệt kê các từ khó, cụm từ (phrasal verbs), hoặc thành ngữ (idioms) xuất hiện trong mô tả hoặc ví dụ.
          Trả về JSON chính xác.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          ipa: { type: Type.STRING },
          vi: { type: Type.STRING },
          example_en: { type: Type.STRING },
          example_vi: { type: Type.STRING },
          details_en: { type: Type.STRING },
          details_vi: { type: Type.STRING },
          predictions_en: { type: Type.STRING },
          predictions_vi: { type: Type.STRING },
          is_human: { type: Type.BOOLEAN },
          grammar_analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'other'] },
                explanation_vi: { type: Type.STRING }
              },
              required: ["text", "type", "explanation_vi"]
            }
          },
          vocabulary_breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                type: { type: Type.STRING },
                ipa: { type: Type.STRING },
                meaning_vi: { type: Type.STRING }
              },
              required: ["term", "type", "ipa", "meaning_vi"]
            }
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            minItems: 4,
            maxItems: 4
          },
        },
        required: ["en", "ipa", "vi", "example_en", "example_vi", "details_en", "details_vi", "is_human", "grammar_analysis", "vocabulary_breakdown", "box_2d"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("AI không tìm thấy kết quả");
  return JSON.parse(text) as RecognitionResult;
};

export const translateText = async (text: string, fromLang: string, toLang: string): Promise<TranslationResponse> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Phân tích và dịch đoạn văn bản sau: "${text}" từ ngôn ngữ ${fromLang} sang ${toLang}. Trả về JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          original_text: { type: Type.STRING },
          translated_text: { type: Type.STRING },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                ipa: { type: Type.STRING },
                meaning: { type: Type.STRING }
              },
              required: ["word", "ipa", "meaning"]
            }
          },
          grammar: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reply_en: { type: Type.STRING },
                reply_vi: { type: Type.STRING }
              },
              required: ["reply_en", "reply_vi"]
            }
          },
          follow_up: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text_en: { type: Type.STRING },
                text_vi: { type: Type.STRING }
              },
              required: ["text_en", "text_vi"]
            }
          }
        },
        required: ["original_text", "translated_text", "vocabulary", "grammar", "suggestions", "follow_up"]
      }
    }
  });
  return JSON.parse(response.text) as TranslationResponse;
};
