// Firebase AI Logic (Gemini Developer API backend) implementation of AskAiProvider.
// Mirrors AskAiRepository.kt: same model name, JSON response MIME type, response schema and prompt.
//
// NOTE on App Check: the Kotlin app protects AI Logic with Firebase App Check (Play Integrity /
// reCAPTCHA). The Firebase JS SDK in React Native has no native App Check attestation provider,
// so if App Check enforcement is ON for the Gemini API in the Firebase console, these calls will be
// rejected and the app automatically falls back to the local keyword parser (see ask-ai.ts).
import type { FirebaseApp } from 'firebase/app';
import { GoogleAIBackend, Schema, getAI, getGenerativeModel, type GenerativeModel } from 'firebase/ai';

import { RV_FEATURE_WIRES, RV_SORT_WIRES, RV_TYPE_WIRES, buildAgentInstruction, type AiParsedQuery, type AskAiProvider } from './types';

export const AI_TIMEOUT_MS = 60_000;

export function buildQuerySchema() {
  return Schema.object({
    properties: {
      agentSummary: Schema.string({
        description: "A concise 1-2 sentence explanation of how you matched the shopper's RV request.",
      }),
      outfitterTip: Schema.string({
        description:
          'One practical RV buying tip relevant to their query (e.g., payload, storage length, solar, or slide-out trade-offs).',
      }),
      rvTypes: Schema.array({
        items: Schema.enumString({ enum: [...RV_TYPE_WIRES] }),
        description: 'Matched RV types if mentioned by the shopper.',
      }),
      priceMinUsd: Schema.number({ description: 'Minimum budget in USD if stated.', nullable: true }),
      priceMaxUsd: Schema.number({ description: 'Maximum budget in USD if stated.', nullable: true }),
      location: Schema.string({
        description: 'City, state, or ZIP code if stated (no street address).',
        nullable: true,
      }),
      radiusMiles: Schema.number({ description: 'Search radius in miles if stated (1 to 3000).', nullable: true }),
      condition: Schema.enumString({ enum: ['any', 'new', 'used'], description: 'Condition preference.' }),
      sleepsMin: Schema.integer({ description: 'Minimum sleeping capacity if stated (1 to 14).', nullable: true }),
      lengthMaxFt: Schema.number({ description: 'Maximum length in feet if stated (8 to 60).', nullable: true }),
      towVehicle: Schema.string({ description: 'Tow vehicle year/make/model if stated.', nullable: true }),
      truckTowRatingLbs: Schema.number({ description: 'Explicit tow rating in pounds if stated.', nullable: true }),
      desiredFeatures: Schema.array({
        items: Schema.enumString({ enum: [...RV_FEATURE_WIRES] }),
        description: 'Preferred RV features if mentioned.',
      }),
      fuelType: Schema.string({
        description: "Only 'gas' or 'diesel' if explicitly stated, otherwise null.",
        nullable: true,
      }),
      make: Schema.string({
        description: 'Manufacturer brand if explicitly named (e.g. Winnebago, Tiffin, Airstream, Grand Design).',
        nullable: true,
      }),
      keywords: Schema.string({
        description: "Short RV keywords like 'slide-out' or 'bunkhouse' if useful for MCP search.",
        nullable: true,
      }),
      sort: Schema.enumString({ enum: [...RV_SORT_WIRES], description: 'Recommended sort order.' }),
    },
    optionalProperties: [
      'priceMinUsd',
      'priceMaxUsd',
      'location',
      'radiusMiles',
      'sleepsMin',
      'lengthMaxFt',
      'towVehicle',
      'truckTowRatingLbs',
      'fuelType',
      'make',
      'keywords',
    ],
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Ask AI timed out after 60 seconds. Please try again.')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export class FirebaseAiProvider implements AskAiProvider {
  readonly id = 'firebase-ai' as const;
  readonly label = 'Gemini via Firebase AI Logic';
  private model: GenerativeModel | null = null;

  constructor(
    private readonly getApp: () => FirebaseApp | null,
    private readonly modelName: string,
  ) {}

  isAvailable(): boolean {
    return this.getApp() != null;
  }

  private ensureModel(): GenerativeModel {
    if (this.model) return this.model;
    const app = this.getApp();
    if (!app) throw new Error('Firebase is not configured.');
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    this.model = getGenerativeModel(ai, {
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json', responseSchema: buildQuerySchema() },
    });
    return this.model;
  }

  async parse(prompt: string): Promise<AiParsedQuery> {
    const model = this.ensureModel();
    const result = await withTimeout(model.generateContent(buildAgentInstruction(prompt.trim())), AI_TIMEOUT_MS);
    const text = result.response.text();
    if (!text || text.trim().length === 0) throw new Error('AI agent returned an empty response.');
    return JSON.parse(text) as AiParsedQuery;
  }
}
