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
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: pureBase64,
          },
        },
        {
          text: `Bạn là một chuyên gia bách khoa toàn thư và cố vấn chuyên môn cao cấp.
          LĨNH VỰC TRỌNG TÂM: ${topic}.
          YÊU CẦU RIÊNG TỪ NGƯỜI DÙNG: ${userPrompt || 'Không có yêu cầu riêng'}.
          
          Hãy phân tích đối tượng hoặc hành động trong ảnh/video một cách cực kỳ chuyên sâu dựa trên lĩnh vực trọng tâm và yêu cầu người dùng nếu có.
          
          YÊU CẦU CHI TIẾT:
          1. Tên định danh (EN+IPA+VI).
          2. Mô tả bối cảnh và ngoại hình cực kỳ chi tiết.
          3. PHÂN TÍCH CHUYÊN GIA (expert_insights): Mỗi lĩnh vực cần có cả 2 bản: [field]_en và [field]_vi.
             - Scientific: Giá trị khoa học, phân loại, đặc điểm sinh học/vật lý.
             - Medical: Tác động sức khỏe, y tế hoặc an toàn.
             - Technical: Cấu tạo kỹ thuật, công nghệ, cách vận hành.
             - Educational: Giá trị giáo dục, bài học rút ra.
             - Fashion: Nếu liên quan thời trang, phân tích: style_analysis, age_group, estimated_price, skin_tone_compatibility (mỗi cái đều EN và VI).
             
          4. PHÂN TÍCH CHẤT PHỤ GIA (additives) - CỰC KỲ QUAN TRỌNG:
             Nếu phát hiện mã số phụ gia thực phẩm (ví dụ: 451i, E621, 211, 452, 635, v.v.):
             - Mỗi chất phải được liệt kê vào mảng 'additives'.
             - Phân tích dưới góc độ chuyên gia độc tính học & dinh dưỡng:
               + code: Mã số (vd: 451i).
               + name: Tên hóa học đầy đủ.
               + function: Tác dụng cụ thể trong thực phẩm (vd: tạo xốp, bảo quản).
               + harmful_effects: Tác hại trực tiếp đến sức khỏe.
               + dosage: Liều lượng ADI (nếu có) và giới hạn an toàn.
               + metabolism_time: Thời gian cơ thể cần để chuyển hóa/đào thải hoàn toàn.
               + long_term_risks: Hệ lụy khi dùng lâu dài/quá liều (bệnh lý tiềm tàng).
          
          5. PHÂN TÍCH NGỮ PHÁP & TỪ VỰNG: Như một giảng viên ngôn ngữ.
          6. BÀI TẬP THỰC HÀNH (exercises): Tạo ra 3-5 câu hỏi trắc nghiệm (về từ vựng hoặc ngữ pháp) dựa trên nội dung phân tích.
          7. BÀI HỌC CHÍNH (main_lessons): 3 bài học hoặc kiến thức then chốt cần ghi nhớ.
          
          LƯU Ý QUAN TRỌNG:
          - TUYỆT ĐỐI KHÔNG ĐƯỢC LẶP LẠI TỪ VỰNG: Tránh lặp lại cùng một cụm từ vô nghĩa hoặc lỗi lặp từ hệ thống. Văn phong phải trôi chảy, đa dạng.
          - KIẾM TRA LẠI NỘI DUNG TRƯỚC KHI TRẢ VỀ: Đảm bảo không có các đoạn văn bị treo hoặc lặp lại vô tận.
          
          LUÔN TRẢ VỀ JSON HỢP LỆ. Nếu không có phụ gia, trả về mảng 'additives' rỗng.`,
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
    return JSON.parse(text) as RecognitionResult;
  } catch (parseError) {
    console.error("Analysis Parse Error:", parseError);
    throw new Error("Không thể xử lý dữ liệu từ AI. Hãy thử lại với góc quay khác.");
  }
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

export const lookupWord = async (word: string, context: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Tra cứu từ vựng "${word}" trong ngữ cảnh: "${context}". Trả về JSON gồm: term, ipa, meaning_vi, explanation.`,
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
    ? `VÙNG CHỌN (Bounding Box): ymin=${ymin.toFixed(1)}%, xmin=${xmin.toFixed(1)}%, ymax=${ymax.toFixed(1)}%, xmax=${xmax.toFixed(1)}%`
    : `TỌA ĐỘ ĐIỂM: x=${xmin.toFixed(1)}%, y=${ymin.toFixed(1)}%`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: pureBase64,
          },
        },
        {
          text: `Bạn là Hệ thống Nhận diện Vật thể thông minh.
          Người dùng đã chọn một ${locationDesc} trong hình ảnh/video đính kèm.
          Tọa độ (0,0) là góc trên bên trái, (100,100) là góc dưới bên phải.
          
          NHIỆM VỤ CỦA BẠN:
          1. Xác định CHÍNH XÁC đối tượng hoặc bộ phận chủ đạo bên trong ${isRegion ? 'vùng chọn này' : 'vị trí này'}.
          2. Cung cấp thông tin chi tiết về đối tượng đó bao gồm: Tên tiếng Anh, phiên âm IPA, nghĩa tiếng Việt, và các phân tích chuyên môn (Expert Insights). Phân tích chuyên môn phải có bản Việt (_vi) và Anh (_en).
          3. Quan trọng: Trả về box_2d theo định dạng [ymin, xmin, ymax, xmax] từ 0-1000 bao quanh đối tượng vừa xác định.
          4. Ngữ cảnh tổng quát của toàn cảnh là: ${originalTopic}.
          
          LUÔN TRẢ VỀ JSON HỢP LỆ THEO ĐÚNG CẤU TRÚC RECOGNITIONRESULT.`
        }
      ]
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
  return JSON.parse(text) as RecognitionResult;
};
