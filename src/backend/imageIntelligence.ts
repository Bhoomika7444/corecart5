/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Image Intelligence Pipeline
 * ---------------------------
 * Turns a raw business/product description into highly descriptive,
 * commercial-quality image prompts (analyzed with NVIDIA when configured),
 * then renders them with a free text-to-image generator (Pollinations).
 * This replaces generic/random stock imagery (Unsplash/Picsum/LoremFlickr
 * placeholders) with images that are actually about the business the user
 * described.
 *
 * Design goals:
 *  - No category-specific hardcoding: every website category (grocery,
 *    electronics, furniture, hospitals, restaurants, services, etc.) is
 *    handled by the same generic LLM-driven analysis + prompt pipeline.
 *  - Consistency: a single "visual brief" is derived once per store and
 *    reused for every image generated for that store, so lighting,
 *    palette, composition, and mood stay consistent across the hero
 *    banner and every product image.
 *  - Safe degradation: if no NVIDIA API key is configured, or a call
 *    fails for any reason, callers get a heuristic brief / placeholder
 *    image back. Nothing here ever throws out to the caller, and no
 *    existing behaviour changes when the AI client is unavailable.
 */

import { nvidiaGenerateContent, isNvidiaConfigured } from "./nvidia";
import * as crypto from "crypto";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface VisualBrief {
  websiteCategory: string;
  industry: string;
  businessType: string;
  productsOrServices: string[];
  mainSubjects: string[];
  targetAudience: string;
  visualStyle: string;
  brandPersonality: string;
  colorPalette: string;
  photographyStyle: string;
  mood: string;
}

export type ImageKind = "hero" | "product" | "category" | "about";

export interface ContextualImageRequest {
  /** Stable key (usually the store id) used to cache & reuse the visual brief for consistency. */
  cacheKey: string;
  businessName: string;
  businessType: string;
  description?: string;
  /** Raw free-text the user supplied describing their website, if available. */
  rawText?: string;
  kind: ImageKind;
  /** The exact main subject that MUST appear in the image (e.g. an exact product title/service name). */
  subject: string;
  subjectDescription?: string;
  aspectRatio?: "1:1" | "16:9" | "4:3" | "9:16" | "3:4";
}

// ------------------------------------------------------------------
// In-memory caches (per server process) so repeated calls for the same
// store reuse the same analyzed brief instead of re-analyzing every time.
// ------------------------------------------------------------------

const briefCache = new Map<string, VisualBrief>();

function seedFromKey(key: string): number {
  const hash = crypto.createHash("md5").update(key).digest();
  return hash.readUInt32BE(0) % 2147483647;
}

// ------------------------------------------------------------------
// Step 1: Understand user intent -> Identify business and products
// ------------------------------------------------------------------

function heuristicBrief(businessType: string, description?: string, rawText?: string): VisualBrief {
  const source = `${businessType} ${description || ""} ${rawText || ""}`.toLowerCase();

  const pick = (pairs: [string[], string][], fallback: string): string => {
    for (const [keywords, value] of pairs) {
      if (keywords.some((k) => source.includes(k))) return value;
    }
    return fallback;
  };

  const industry = pick(
    [
      [["furniture", "home decor", "interior"], "Home & Furniture"],
      [["electr", "gadget", "phone", "laptop", "computer"], "Consumer Electronics"],
      [["grocer", "food", "organic", "produce", "supermarket"], "Grocery & Food Retail"],
      [["fashion", "apparel", "cloth", "wear", "boutique"], "Fashion & Apparel"],
      [["perfume", "fragrance", "cosmetic", "beauty", "skincare"], "Beauty & Cosmetics"],
      [["book", "library", "publish"], "Books & Media"],
      [["jewel", "gold", "diamond", "gem"], "Jewelry & Luxury Goods"],
      [["sport", "fit", "gym", "athlet"], "Sports & Fitness"],
      [["medic", "health", "pharma", "hospital", "clinic", "doctor"], "Healthcare & Medical"],
      [["restau", "cafe", "dine", "kitchen", "bakery"], "Restaurant & Food Service"],
      [["real estate", "property", "realty"], "Real Estate"],
      [["law", "legal", "attorney"], "Legal Services"],
      [["education", "school", "course", "tutor", "academy"], "Education"],
      [["travel", "tour", "hotel", "resort"], "Travel & Hospitality"],
      [["automotive", "car", "vehicle", "auto repair"], "Automotive"],
      [["pet", "veterin"], "Pet Care"],
      [["software", "saas", "app", "tech startup", "it services"], "Technology & Software"],
    ],
    businessType || "General Retail"
  );

  return {
    websiteCategory: businessType || "General Retail",
    industry,
    businessType: businessType || "General Retail",
    productsOrServices: [],
    mainSubjects: [],
    targetAudience: "General consumers",
    visualStyle: "modern, clean, premium commercial",
    brandPersonality: "trustworthy, professional, approachable",
    colorPalette: "neutral tones with a confident accent color",
    photographyStyle: "photorealistic studio and lifestyle photography",
    mood: "inviting and aspirational",
  };
}

/**
 * Step 1-2: Understand user intent, identify business/industry/products, and
 * extract everything needed to write great image prompts later. Cached per
 * cacheKey (store id) so every image generated for the same store shares one
 * consistent visual identity.
 */
export async function getVisualBrief(input: {
  cacheKey: string;
  businessName: string;
  businessType: string;
  description?: string;
  rawText?: string;
}): Promise<VisualBrief> {
  const cached = briefCache.get(input.cacheKey);
  if (cached) return cached;

  const fallback = heuristicBrief(input.businessType, input.description, input.rawText);

  if (!isNvidiaConfigured()) {
    briefCache.set(input.cacheKey, fallback);
    return fallback;
  }

  try {
    const prompt = `
      You are a creative director analyzing a business so a photorealistic image generation model can create
      accurate, on-brand commercial imagery for its website.

      Business name: ${input.businessName}
      Stated business type/category: ${input.businessType}
      Description: ${input.description || "(none provided)"}
      Raw requirements text (if any): ${input.rawText ? input.rawText.slice(0, 4000) : "(none provided)"}

      Analyze this and return a single JSON object describing exactly what must visually appear in this
      business's imagery and how it should be photographed. Be concrete and specific about the physical
      objects, people, or settings that must appear — never abstract, generic, or decorative-only concepts.

      The JSON object MUST have exactly these keys:
      {
        "websiteCategory": string,
        "industry": string,
        "businessType": string,
        "productsOrServices": string[],
        "mainSubjects": string[],   // concrete physical objects/people/settings that MUST be visible (e.g. "shampoo bottles", "dining tables", "doctors examining patients")
        "targetAudience": string,
        "visualStyle": string,
        "brandPersonality": string,
        "colorPalette": string,
        "photographyStyle": string,
        "mood": string
      }
    `;

    const responseText = await nvidiaGenerateContent(prompt, { json: true });
    if (!responseText) {
      throw new Error("NVIDIA returned an empty response.");
    }

    const data = JSON.parse(responseText.trim());
    const brief: VisualBrief = {
      websiteCategory: data.websiteCategory || fallback.websiteCategory,
      industry: data.industry || fallback.industry,
      businessType: data.businessType || fallback.businessType,
      productsOrServices: Array.isArray(data.productsOrServices) ? data.productsOrServices : [],
      mainSubjects: Array.isArray(data.mainSubjects) ? data.mainSubjects : [],
      targetAudience: data.targetAudience || fallback.targetAudience,
      visualStyle: data.visualStyle || fallback.visualStyle,
      brandPersonality: data.brandPersonality || fallback.brandPersonality,
      colorPalette: data.colorPalette || fallback.colorPalette,
      photographyStyle: data.photographyStyle || fallback.photographyStyle,
      mood: data.mood || fallback.mood,
    };

    briefCache.set(input.cacheKey, brief);
    return brief;
  } catch (err) {
    console.error("Visual brief analysis failed, using heuristic fallback:", err);
    briefCache.set(input.cacheKey, fallback);
    return fallback;
  }
}

// ------------------------------------------------------------------
// Step 3: Generate optimized, highly descriptive image prompts
// ------------------------------------------------------------------

/**
 * Transforms the raw request into a detailed, commercial-quality image prompt.
 * The requested main subject is always stated explicitly and first, so it can
 * never be dropped in favor of generic scenery or abstract art.
 */
export function buildImagePrompt(brief: VisualBrief, opts: { kind: ImageKind; subject: string; subjectDescription?: string }): string {
  const subject = opts.subject.trim();
  const subjectLine = opts.subjectDescription ? `${subject} — ${opts.subjectDescription}` : subject;

  const framingByKind: Record<ImageKind, string> = {
    hero: `Wide commercial hero banner photograph for a ${brief.industry} website. The image MUST prominently and unmistakably feature ${subjectLine}, shown large and in clear focus as the undeniable main subject, set within a real, relevant environment for this business (not an empty studio backdrop).`,
    product: `Premium e-commerce product photograph. The image MUST prominently feature ${subjectLine} as the single clear hero subject, centered, sharply in focus, filling most of the frame, on a clean uncluttered background appropriate for a ${brief.industry} storefront.`,
    category: `Commercial category showcase photograph for a ${brief.industry} website. The image MUST clearly and prominently show ${subjectLine}, arranged attractively and instantly recognizable as this category.`,
    about: `Authentic editorial lifestyle photograph representing the brand story of a ${brief.industry} business. The image MUST prominently include ${subjectLine} in a real-world, in-use setting.`,
  };

  const negative =
    "Do not use abstract art, unrelated landscapes, galaxies, generic stock-photo scenery, empty backgrounds, or any subject other than what is specified. No text, no watermarks, no logos, no borders.";

  return [
    framingByKind[opts.kind],
    `Industry context: ${brief.industry} (${brief.businessType}).`,
    brief.targetAudience ? `Target audience: ${brief.targetAudience}.` : "",
    `Visual style: ${brief.visualStyle}.`,
    `Brand personality: ${brief.brandPersonality}.`,
    `Color palette: ${brief.colorPalette}.`,
    `Photography style: ${brief.photographyStyle}.`,
    `Mood: ${brief.mood}.`,
    "Photorealistic, premium commercial quality, high resolution, modern, professional, website-ready.",
    negative,
  ]
    .filter(Boolean)
    .join(" ");
}

// ------------------------------------------------------------------
// Step 4: Call the image generation model
// ------------------------------------------------------------------

const ASPECT_TO_DIMENSIONS: Record<NonNullable<ContextualImageRequest["aspectRatio"]>, { width: number; height: number }> = {
  "1:1": { width: 800, height: 800 },
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 1024, height: 768 },
  "9:16": { width: 720, height: 1280 },
  "3:4": { width: 768, height: 1024 },
};

/**
 * Builds a Pollinations.ai text-to-image URL. Pollinations requires no API
 * key and generates a real image from the prompt on the fly (the browser
 * fetches it when the <img> tag loads), so it is used as the always-available
 * fallback for image rendering (NVIDIA models are text-only). This is what actually
 * guarantees "type any product name -> get an image of that product",
 * instead of the old keyword-matched stock-photo fallbacks (loremflickr /
 * picsum) which frequently returned completely unrelated images for
 * arbitrary/invented product names.
 */
function buildPollinationsImageUrl(
  prompt: string,
  aspectRatio: ContextualImageRequest["aspectRatio"],
  seedKey: string
): string {
  const { width, height } = ASPECT_TO_DIMENSIONS[aspectRatio || "1:1"];
  const seed = seedFromKey(seedKey);
  // Pollinations reads the prompt from the URL path, so keep it URL-safe and
  // bounded in length.
  const cleanPrompt = prompt.slice(0, 800);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
}

/**
 * Confirms a Pollinations URL actually resolves to real image bytes (not
 * just a 200 status - some transient failures still return 200 with an
 * error page or empty body). Draining the body ensures the image fully
 * finished rendering, not just started.
 */
async function urlResolvesToImage(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    const bytes = await res.arrayBuffer();
    return contentType.startsWith("image/") && bytes.byteLength > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A same-shape fallback to the client's own placeholder (StoreRenderer's
 * buildPlaceholderImage): a self-contained inline SVG data URI, so it can
 * never itself fail to load over the network. Used only when Pollinations
 * couldn't render anything after retrying, so the storefront still always
 * shows *something* instead of a broken image icon.
 */
function buildLocalPlaceholder(label: string): string {
  const initial = (label || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#e2e8f0"/>
    <text x="200" y="220" font-family="system-ui, sans-serif" font-size="120" font-weight="700" fill="#94a3b8" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Full pipeline: analyze (NVIDIA, if configured) -> build prompt -> render image.
 *
 * The visual brief is derived with NVIDIA when NVIDIA_API_KEY is set, otherwise a
 * heuristic brief is used. The image itself is always rendered with
 * Pollinations.ai (a free text-to-image generator that needs no API key),
 * since NVIDIA's models are text-only. A real image URL that matches `subject`
 * is returned — this function is designed to essentially always succeed, so
 * callers no longer need their old random stock-photo fallbacks.
 */
export async function generateContextualImage(input: ContextualImageRequest): Promise<string | null> {
  const brief = await getVisualBrief({
    cacheKey: input.cacheKey,
    businessName: input.businessName,
    businessType: input.businessType,
    description: input.description,
    rawText: input.rawText,
  });

  const prompt = buildImagePrompt(brief, {
    kind: input.kind,
    subject: input.subject,
    subjectDescription: input.subjectDescription,
  });

  // NVIDIA's models are text-only, so there is no LLM image-generation step.
  // We render the image from the NVIDIA/heuristic-derived prompt using
  // Pollinations.ai, a free text-to-image generator that needs no API key.
  //
  // Pollinations renders on-demand rather than serving a static file, so a
  // request can transiently fail, time out, or return a broken response
  // under load. Previously we handed the built URL straight to the client
  // and hoped the browser's <img> load would succeed - it often didn't,
  // showing a broken image or letter placeholder even when the same prompt
  // would have worked a few seconds later. Instead, verify the image
  // actually renders here on the server (with retries) before ever handing
  // the URL back, so by the time a product reaches the storefront its image
  // is already generated and cached upstream - the browser's load is then
  // just a fast cache hit instead of a live generation race.
  let candidateUrl: string;
  try {
    candidateUrl = buildPollinationsImageUrl(prompt, input.aspectRatio, `${input.cacheKey}:${input.kind}:${input.subject}`);
  } catch (err) {
    console.error(`Pollinations URL build failed (kind=${input.kind}, subject="${input.subject}"):`, err);
    return buildLocalPlaceholder(input.subject);
  }

  const attemptTimeoutsMs = [8000, 10000];
  for (const timeoutMs of attemptTimeoutsMs) {
    const ok = await urlResolvesToImage(candidateUrl, timeoutMs);
    if (ok) return candidateUrl;
  }

  // Every verification attempt failed - Pollinations is unreachable/
  // overloaded right now. Return a guaranteed-to-render local placeholder
  // instead of a URL we already know the client would just fail to load too.
  console.error(`Pollinations image never resolved after retries (kind=${input.kind}, subject="${input.subject}"), using local placeholder.`);
  return buildLocalPlaceholder(input.subject);
}

/** Clears the in-memory visual brief cache. Exposed for testing purposes only. */
export function __clearVisualBriefCache(): void {
  briefCache.clear();
}
