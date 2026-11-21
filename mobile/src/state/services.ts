import { FirebaseAiProvider } from '@/lib/ai/firebase-provider';
import { LocalKeywordProvider } from '@/lib/ai/local-parser';
import { config } from '@/lib/config';
import { getDb, getFirebaseApp } from '@/lib/firebase/app';
import { MatchRvFirestoreRepository } from '@/lib/firebase/repository';
import { MatchRvMcpClient } from '@/lib/mcp/client';

export const mcp = new MatchRvMcpClient({ endpoint: config.mcpUrl });

let repo: MatchRvFirestoreRepository | null | undefined;
export function getRepository(): MatchRvFirestoreRepository | null {
  if (repo === undefined) {
    const db = getDb();
    repo = db ? new MatchRvFirestoreRepository(db) : null;
  }
  return repo;
}

export const askAiPrimary = new FirebaseAiProvider(getFirebaseApp, config.geminiModel);
export const askAiFallback = new LocalKeywordProvider();
