import { GoogleGenAI, Type } from "@google/genai";
import { RecognitionResult, TranslationResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeMedia = async (
  base64Data: string, 
  mimeType: string, 
  topic: string = "Tổng quát", 
  userPrompt: string = ""
): Promise<RecognitionResult> => {
  const pureBase64 = base64Data.split(',')[1] || base64Data;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: pureBase64,
          },
        },
        {
          text: `Bạn là một chuyên gia bách khoa toàn thư và cố vấn giáo dục đa ngôn ngữ.
          CHỦ ĐỀ: ${topic}.
          YÊU CẦU: ${userPrompt || 'Phân tích chi tiết đối tượng/bối cảnh'}.
          
          HÃY PHÂN TÍCH CHUYÊN SÂU:
          1. Định danh chính xác (EN+IPA+VI).
          2. Mô tả bối cảnh (Details): EN (văn phong học thuật) và VI (dễ hiểu). Mỗi bản tối đa 150 từ.
          3. EXPERT INSIGHTS (Bản EN và VI):
             - Science: Phân loại, đời sống, vật lý.
             - Medical/Health: An toàn, dinh dưỡng, sức khỏe.
             - Tech: Cấu tạo, nguyên lý.
             - Education: Ý nghĩa giáo dục.
             - Fashion (nếu có): Style, age, price, skin tone.
          4. PHỤ GIA THỰC PHẨM (Additives): Nếu có mã số như E102, 451i... hãy phân tích độc tính, liều lượng an toàn (ADI), thời gian đào thải và rủi ro lâu dài.
          5. NGÔN NGỮ: Phân tích ngữ pháp và 5 từ vựng then chốt.
          6. THỰC HÀNH: 3 câu hỏi trắc nghiệm (options là mảng chuỗi).
          7. BÀI HỌC: 3 điểm mấu chốt.
          
          RÀO CẢN KỸ THUẬT QUAN TRỌNG:
          - KHÔNG ĐƯỢC LẶP LẠI: Tuyệt đối không lặp lại cùng một câu hoặc đoạn văn. 
          - KHÔNG HALLUCINATION: Chỉ nói những gì chắc chắn.
          - NGẮN GỌN & SÚC TÍCH: Tập trung vào kiến thức giá trị cao.
          
          TRẢ VỀ JSON HỢP LỆ.`,
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
          expert_insights: {
            type: Type.OBJECT,
            properties: {
              scientific_en: { type: Type.STRING },
              scientific_vi: { type: Type.STRING },
              medical_en: { type: Type.STRING },
              medical_vi: { type: Type.STRING },
              technical_en: { type: Type.STRING },
              technical_vi: { type: Type.STRING },
              educational_en: { type: Type.STRING },
              educational_vi: { type: Type.STRING },
              additives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    name: { type: Type.STRING },
                    function: { type: Type.STRING },
                    harmful_effects: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    metabolism_time: { type: Type.STRING },
                    long_term_risks: { type: Type.STRING }
                  },
                  required: ["code", "name", "function", "harmful_effects", "dosage", "metabolism_time", "long_term_risks"]
                }
              },
              fashion: {
                type: Type.OBJECT,
                properties: {
                  style_analysis_en: { type: Type.STRING },
                  style_analysis_vi: { type: Type.STRING },
                  age_group_en: { type: Type.STRING },
                  age_group_vi: { type: Type.STRING },
                  estimated_price_en: { type: Type.STRING },
                  estimated_price_vi: { type: Type.STRING },
                  skin_tone_compatibility_en: { type: Type.STRING },
                  skin_tone_compatibility_vi: { type: Type.STRING }
                }
              }
            }
          },
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
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["vocabulary", "grammar"] },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correct_answer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["type", "question", "options", "correct_answer", "explanation"]
            }
          },
          main_lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
        required: ["en", "ipa", "vi", "example_en", "example_vi", "details_en", "details_vi", "is_human", "grammar_analysis", "vocabulary_breakdown", "exercises", "main_lessons"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("AI không tìm thấy kết quả");
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleanText) as RecognitionResult;
  } catch (err: any) {
    console.error("Analysis Parse Error:", err);
    throw new Error("Không thể xử lý dữ liệu từ AI. Hãy thử lại với góc quay khác.");
  }
};

export const translateText = async (text: string, fromLang: string, toLang: string): Promise<TranslationResponse> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Dịch văn bản sau: "${text}" từ ${fromLang} sang ${toLang}. Trả về JSON theo schema.`,
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

export const lookupWord = async (word: string, context: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Tra cứu từ "${word}" trong ngữ cảnh: "${context}". Trả về JSON {term, ipa, meaning_vi, explanation}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          ipa: { type: Type.STRING },
          meaning_vi: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["term", "ipa", "meaning_vi", "explanation"]
      }
    }
  });
  return JSON.parse(response.text) as any;
};

export const identifyPoint = async (
  base64Data: string, 
  mimeType: string, 
  coords: { x: number, y: number, width?: number, height?: number },
  originalTopic: string
): Promise<RecognitionResult> => {
  const pureBase64 = base64Data.split(',')[1] || base64Data;
  const isRegion = coords.width !== undefined && coords.height !== undefined && (Math.abs(coords.width) > 1 || Math.abs(coords.height) > 1);
  
  let xmin = coords.x;
  let ymin = coords.y;
  let xmax = isRegion ? coords.x + coords.width! : coords.x;
  let ymax = isRegion ? coords.y + coords.height! : coords.y;

  if (xmax < xmin) [xmin, xmax] = [xmax, xmin];
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin];

  const locationDesc = isRegion 
    ? `VÙNG CHỌN [ymin=${ymin.toFixed(1)}%, xmin=${xmin.toFixed(1)}%, ymax=${ymax.toFixed(1)}%, xmax=${xmax.toFixed(1)}%]`
    : `ĐIỂM CHỌN [x=${xmin.toFixed(1)}%, y=${ymin.toFixed(1)}%]`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: pureBase64,
          },
        },
        {
          text: `Bạn là Hệ thống Nhận diện Vật thể.
          Đối tượng tại ${locationDesc}. Tọa độ 0-100.
          CHỦ ĐỀ: ${originalTopic}.
          
          YÊU CẦU:
          1. Xác định đối tượng tại vị trí đó.
          2. Cung cấp EN, IPA, VI, Example, Details, Expert Insights, Grammar, Vocabulary, Exercises, Lessons.
          3. Trả về box_2d [ymin, xmin, ymax, xmax] từ 0-1000 bao quanh đối tượng.
          
          TRẢ VỀ JSON HỢP LỆ. KHÔNG LẶP LẠI NỘI DUNG.`,
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
          box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          grammar_analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING },
                explanation_vi: { type: Type.STRING }
              }
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
              }
            }
          },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correct_answer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          main_lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              }
            }
          },
          expert_insights: {
            type: Type.OBJECT,
            properties: {
              scientific_en: { type: Type.STRING },
              scientific_vi: { type: Type.STRING },
              medical_en: { type: Type.STRING },
              medical_vi: { type: Type.STRING },
              technical_en: { type: Type.STRING },
              technical_vi: { type: Type.STRING },
              educational_en: { type: Type.STRING },
              educational_vi: { type: Type.STRING },
              additives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    name: { type: Type.STRING },
                    function: { type: Type.STRING },
                    harmful_effects: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    metabolism_time: { type: Type.STRING },
                    long_term_risks: { type: Type.STRING }
                  },
                  required: ["code", "name", "function", "harmful_effects", "dosage", "metabolism_time", "long_term_risks"]
                }
              },
              fashion: {
                type: Type.OBJECT,
                properties: {
                  style_analysis_en: { type: Type.STRING },
                  style_analysis_vi: { type: Type.STRING },
                  age_group_en: { type: Type.STRING },
                  age_group_vi: { type: Type.STRING },
                  estimated_price_en: { type: Type.STRING },
                  estimated_price_vi: { type: Type.STRING },
                  skin_tone_compatibility_en: { type: Type.STRING },
                  skin_tone_compatibility_vi: { type: Type.STRING }
                }
              }
            }
          }
        },
        required: ["en", "ipa", "vi", "details_en", "details_vi", "example_en", "example_vi", "grammar_analysis", "vocabulary_breakdown", "exercises", "main_lessons"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("AI không tìm thấy kết quả cho điểm này");

  // Clean and parse
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as RecognitionResult;
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as RecognitionResult;
      } catch (e2) {
        throw new Error("Không thể xử lý dữ liệu vùng chọn từ AI.");
      }
    }
    throw new Error("AI trả về định dạng không hợp lệ cho vùng chọn.");
  }
};
