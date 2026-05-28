import { GoogleGenAI, Type } from "@google/genai";
import type { AiInsight } from '../types';

// IMPORTANT: This uses process.env.API_KEY. 
// This environment variable must be set in the execution environment.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

const insightSchema = {
    type: Type.OBJECT,
    properties: {
        good_points: {
            type: Type.ARRAY,
            description: "A list of 3 to 5 key positive points mentioned in the reviews, ideally corroborating the business description.",
            items: { type: Type.STRING }
        },
        improvement_points: {
            type: Type.ARRAY,
            description: "A list of 2 to 3 improvement points or constructive criticisms mentioned, highlighting discrepancies with the description if they exist.",
            items: { type: Type.STRING }
        },
        emotional_tone: {
            type: Type.STRING,
            description: "The overall emotional tone of the reviews (e.g., 'Very positive', 'Mixed with positive tendency', 'Negative')."
        },
        recommendation_level: {
            type: Type.STRING,
            description: "The general recommendation level (e.g., 'Highly recommended', 'Recommended with reservations', 'Not recommended')."
        }
    },
    required: ["good_points", "improvement_points", "emotional_tone", "recommendation_level"]
};


export const getBusinessInsights = async (businessDescription: string, reviews: string[]): Promise<AiInsight> => {
    const prompt = `
        Analyze the following business description and its customer reviews.
        Your goal is to create a balanced summary that compares what the business says about itself with what customers actually experience.

        Business Description:
        ---
        ${businessDescription || 'No description provided.'}
        ---

        Customer Reviews:
        ---
        ${reviews.map(r => `- ${r}`).join('\n')}
        ---

        Based on BOTH the description and the reviews, extract key points, both positive and negative, and determine the overall sentiment.
        For example, if the business describes itself as "fast and efficient" but reviews mention "long waits", highlight that discrepancy in the improvement points.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: insightSchema,
                temperature: 0.2,
            },
        });
        
        const jsonText = response.text ? response.text.trim() : '{}';
        const parsedJson = JSON.parse(jsonText);
        
        return parsedJson as AiInsight;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate AI insights.");
    }
};

const replySchema = {
    type: Type.OBJECT,
    properties: {
        replies: {
            type: Type.ARRAY,
            description: "A list of 3 different response drafts for the customer review.",
            items: { type: Type.STRING }
        }
    },
    required: ["replies"]
};


export const getSuggestedReplies = async (reviewText: string, rating: number): Promise<string[]> => {
    const prompt = `
        A customer has left the following review with a rating of ${rating} out of 5 stars.
        Review: "${reviewText}"

        Act as a friendly, professional, and empathetic customer relations manager.
        Generate 3 different concise response drafts.
        - If the rating is low (1-3 stars), one response should be apologetic and offer a solution or contact.
        - If the rating is high (4-5 stars), one response should be thankful.
        - Include a short and friendly option in any case.
        - Don't use placeholders like "[Customer Name]" or "[Company Name]". Speak generally.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: replySchema,
                temperature: 0.7, // A bit more creative for replies
            },
        });
        
        const jsonText = response.text ? response.text.trim() : '{}';
        const parsedJson = JSON.parse(jsonText);
        
        return parsedJson.replies as string[];

    } catch (error) {
        console.error("Error calling Gemini API for replies:", error);
        throw new Error("Failed to generate AI replies.");
    }
};


const reviewDraftSchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "A brief and attractive title for the review, no more than 10 words."
        },
        reviewText: {
            type: Type.STRING,
            description: "The complete review text, with a length of 50 to 150 words, developed from the key points."
        }
    },
    required: ["title", "reviewText"]
};

export const generateReviewDraft = async (keyPoints: string, businessName: string, rating: number): Promise<{ title: string; reviewText: string }> => {
    const prompt = `
        Act as a customer writing a detailed and authentic review about their experience at "${businessName}".
        The customer's rating is ${rating} out of 5 stars. The review tone should match this rating (positive for 4-5 stars, neutral/critical for 1-3 stars).

        The customer has provided the following key points about their experience:
        ---
        ${keyPoints}
        ---

        Based on these points, generate a review draft that includes:
        1. A brief and attractive title.
        2. The review text, developing the key points in a coherent and natural paragraph.

        Make sure the review sounds genuine and personal. Don't use overly corporate or generic language.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: reviewDraftSchema,
                temperature: 0.8, // More creative for review writing
            },
        });
        
        const jsonText = response.text ? response.text.trim() : '{}';
        const parsedJson = JSON.parse(jsonText);
        
        return parsedJson as { title: string; reviewText: string };

    } catch (error) {
        console.error("Error calling Gemini API for review draft:", error);
        throw new Error("Failed to generate AI review draft.");
    }
};

const searchQuerySchema = {
    type: Type.OBJECT,
    properties: {
        searchTerm: {
            type: Type.STRING,
            description: "A general search term extracted from the user's query. For example, if the user searches for 'romantic Italian restaurant', the term could be 'romantic'."
        },
        category: {
            type: Type.STRING,
            description: "The most relevant business category based on the query. For example, for 'romantic Italian restaurant', the category should be 'Food & Restaurants: Restaurants'."
        }
    },
    required: ["searchTerm", "category"]
};

export const generateSearchQueryFromPrompt = async (prompt: string): Promise<{ searchTerm: string; category: string; }> => {
    const fullPrompt = `
        Analyze the following user search query and extract it into a structured JSON object with a search term and a business category.

        User query: "${prompt}"

        Examples:
        - if the query is "trusted mechanic shops", the result should be { "searchTerm": "trusted", "category": "Automotive: Mechanic Shops" }
        - if the query is "quiet cafes for working", the result should be { "searchTerm": "quiet for working", "category": "Food & Restaurants: Bars and Cafes" }
        - if the query is "divorce lawyers", the result should be { "searchTerm": "divorce", "category": "Finance & Legal: Legal Services and Lawyers" }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: searchQuerySchema,
                temperature: 0.1,
            },
        });

        const jsonText = response.text ? response.text.trim() : '{}';
        const parsed = JSON.parse(jsonText);

        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'searchTerm' in parsed &&
            typeof parsed.searchTerm === 'string' &&
            'category' in parsed &&
            typeof parsed.category === 'string'
        ) {
            // FIX: In generateSearchQueryFromPrompt, remove the 'as' cast after runtime validation. The type guard is sufficient for TypeScript to infer the correct type, making the explicit cast redundant and potentially masking other type issues.
            return parsed;
        }

        console.error("Unexpected AI response structure for search query:", parsed);
        throw new Error("Invalid AI response for generating the search query.");


    } catch (error) {
        console.error("Error calling Gemini API for search query generation:", error);
        throw new Error("Failed to generate AI search query.");
    }
};

const memoryCache = new Map<string, string>();

const GOOGLE_LANG_CODES: { [key: string]: string } = {
    'en': 'en',
    'gb': 'en',
    'au': 'en',
    'ko': 'ko',
    'ar': 'ar',
    'nl': 'nl',
    'ru': 'ru',
    'id': 'id',
    'ms': 'ms',
    'tw': 'zh-TW',
    'th': 'th',
    'fa': 'fa',
    'vi': 'vi',
    'bn': 'bn',
    'br': 'pt',
    'pt': 'pt',
    'fr': 'fr',
    'de': 'de',
    'it': 'it',
    'ca': 'ca',
    'cn': 'zh-CN',
    'sv': 'sv',
    'pl': 'pl',
    'ja': 'ja',
    'es': 'es',
};

// Simple hash for cache keys (fast, collision-resistant enough for translations)
function hashText(text: string): string {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return h.toString(36);
}

export const translateText = async (text: string, targetLanguage: string = 'en'): Promise<string> => {
    if (!text) return text;

    const targetCode = GOOGLE_LANG_CODES[targetLanguage] || targetLanguage;
    const memKey = `${text}_${targetCode}`;

    // L1: Memory cache (instant)
    if (memoryCache.has(memKey)) return memoryCache.get(memKey)!;

    const textHash = hashText(text);

    // L2: Supabase cache (persistent across sessions/users)
    try {
        const { getCachedTranslation } = await import('./supabaseService');
        const cached = await getCachedTranslation(textHash, targetCode);
        if (cached) {
            memoryCache.set(memKey, cached);
            return cached;
        }
    } catch { /* Supabase unavailable, continue to Google */ }

    // L3: Google Translate
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const segments = data?.[0];
        if (!Array.isArray(segments)) throw new Error('Unexpected response format');

        const translated = segments.map((seg: any[]) => seg[0]).join('').trim();
        if (!translated) throw new Error('Empty translation');

        memoryCache.set(memKey, translated);

        // Persist to Supabase in background (best effort)
        import('./supabaseService')
            .then(({ setCachedTranslation }) => setCachedTranslation(textHash, text, targetCode, translated))
            .catch(() => {});

        return translated;
    } catch {
        return text;
    }
};