import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { Product, ChatMessage } from './types';

// API key is injected by Vite from GEMINI_API_KEY in .env.local
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL  = 'gemini-3.6-flash';
const MODEL_FALLBACKS = [
  MODEL,
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

const _isRetryable = (error: any): boolean => {
  const msg = (error?.message || error?.toString?.() || '').toString();
  return /429|503|quota|RESOURCE_EXHAUSTED|high demand|UNAVAILABLE|try again later/i.test(msg);
};

const _generateWithFallback = async (request: any, systemInstruction?: string) => {
  let lastError: any = null;
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, ...(systemInstruction ? { systemInstruction } : {}) });
      const result = await model.generateContent(request);
      return result;
    } catch (error: any) {
      lastError = error;
      if (!_isRetryable(error)) throw error;
    }
  }
  throw lastError;
};

// ─── SKIN TONE ANALYSIS ───────────────────────────────────────────────────────
export interface SkinToneResult {
  skinTone: string;
  undertone: string;
  description: string;
}

export const analyzeSkinTone = async (imageData: string): Promise<SkinToneResult> => {
  if (!API_KEY) throw new Error('API key not configured');
  const [header, encoded] = imageData.includes(',') ? imageData.split(',') : ['data:image/jpeg;base64', imageData];
  const mimeType = header.includes('png') ? 'image/png' : header.includes('webp') ? 'image/webp' : 'image/jpeg';
  const imagePart: Part = { inlineData: { data: encoded, mimeType } };
  const prompt = `Analyze the skin tone of the person in this image. Classify it as exactly ONE of: Fair, Medium, Olive, Brown, Dark. Respond ONLY with valid JSON: {"skinTone":"<category>","undertone":"<warm|cool|neutral>","description":"<one sentence about their skin tone>"}`;
  const result = await _generateWithFallback([prompt, imagePart]);
  const text = result.response.text().trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return { skinTone: 'Medium', undertone: 'neutral', description: 'Analysis complete.' };
};

// ─── PRODUCT FIT ANALYSIS ─────────────────────────────────────────────────────
export interface ProductFitResult {
  percentage: number;
  verdict: string;
  analysis: string;
  tip: string;
}

export const analyzeProductFit = async (skinTone: string, product: Product): Promise<ProductFitResult> => {
  if (!API_KEY) throw new Error('API key not configured');
  const prompt = `You are a fashion and beauty expert. Analyze if this product suits someone with ${skinTone} skin tone.
Product: ${product.name}
Category: ${product.category}
Description: ${product.description || 'N/A'}

Provide: 1) A compatibility percentage (0-100). 2) A verdict (Excellent/Good/Moderate/Not Recommended). 3) A 2-3 sentence analysis mentioning specific colors or features relevant to ${skinTone} skin. 4) One short styling tip.
Respond ONLY with valid JSON: {"percentage":<number>,"verdict":"<verdict>","analysis":"<text>","tip":"<text>"}`;
  const result = await _generateWithFallback(prompt);
  const text = result.response.text().trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return { percentage: 75, verdict: 'Good', analysis: 'This product should complement your look well.', tip: 'Style with confidence!' };
};

export const getChatResponse = async (history: ChatMessage[], products: Product[]): Promise<string> => {
  if (!API_KEY) {
    return '⚠️ Gemini API key is not configured. Add GEMINI_API_KEY to your .env.local file.';
  }

  // Build rich product context including description so AI can answer detail questions
  const productContext = products.map(p =>
    `• ${p.name}\n  ID: ${p.id} | Category: ${p.category} | Price: ₹${p.price.toLocaleString('en-IN')} | Rating: ${p.rating}/5\n  Description: ${p.description || 'N/A'}`
  ).join('\n\n');

  const systemInstruction = `You are "SmartShop AI", the intelligent personal shopping assistant for SmartShop — India's premium e-commerce platform.

Your role is to help customers find the perfect products, compare options, understand features, and make smart purchase decisions.

STRICT RULES:
1. PRODUCT SCOPE: ONLY discuss products from the Current Inventory below. Do NOT make up products that are not listed.
2. STOCK STATUS: Every product listed is IN STOCK and ships today.
3. OUT-OF-STOCK: If asked for something not in the list, say "We don't carry that right now" and suggest the closest available alternative.
4. COMPARISONS: Proactively compare prices, ratings and features when multiple options exist.
5. DESCRIPTIONS: You have full product descriptions — use them to answer specific questions (material, use-case, occasion, features).
6. RECOMMENDATIONS: When user asks for product suggestions for ANY occasion (wedding, birthday, party, office, festival, gym, date night, etc.), ALWAYS pick 2–4 of the most fitting products from the inventory and recommend them using the PRODUCT CARD FORMAT below.
7. TONE: Friendly, enthusiastic, conversational. Use emojis where appropriate 🛍️✨.
8. CURRENCY: Always quote prices in ₹ (INR).
9. REVIEW CONTEXT: If asked about reviews or ratings, refer to the rating score from the inventory.
10. FORMATTING: Use clean formatting. For lists use numbered lines (1. 2. 3.) or bullet lines starting with •. Use **bold** for product names and key terms. Keep paragraphs short.

PRODUCT CARD FORMAT (use this whenever recommending products for occasions or comparisons):
Write a short intro line, then for each recommended product write EXACTLY this on its own line:
[PRODUCT:<id>] <one-sentence reason why it suits the occasion>

Example for a wedding recommendation:
✨ Here are my top picks perfect for your wedding day!
[PRODUCT:li-26eb10] A timeless rosy matte shade for a classic bridal pout.
[PRODUCT:sh-cc065d] Elegant heels that will carry you beautifully through every aisle.

Always use the exact product ID from the inventory. Only use this format for product recommendations.

== CURRENT INVENTORY ==
${productContext}
========================`;

  const contents: Content[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  try {
    const result = await _generateWithFallback({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }, systemInstruction);
    return result.response.text();
  } catch (error: any) {
    console.error('Gemini AI Error:', error);
    if (error?.message?.includes('API_KEY')) {
      return '⚠️ Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local.';
    }
    return `⚠️ AI error: ${error.message || error.toString()}`;
  }
};

export const getRecommendations = (baseProduct: Product, allProducts: Product[]): Product[] => {
  return allProducts
    .filter(p => p.id !== baseProduct.id && (p.category === baseProduct.category || p.popularityScore > 0.8))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 4);
};
