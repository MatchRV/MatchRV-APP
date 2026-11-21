// Firestore repository — same collections/paths as MatchRvFirestoreRepository.kt:
//   users/{uid}/saved_rvs, users/{uid}/saved_alerts, users/{uid}/inquiries, users/{uid}/analytics_events
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import type { AlertCheckUpdate } from '../logic/alerts';
import type {
  AnalyticsEventType,
  DealerInquiryRecord,
  SavedRvRecord,
  SavedSearchAlertRecord,
  TimestampLike,
} from '../models/firestore';
import { sanitizeFirestoreDocId } from '../models/firestore';
import type { RvDetail, RvSearchFilter, RvSummary } from '../models/rv';
import {
  buildAnalyticsPayload,
  buildInquiryPayload,
  buildInquiryStatusUpdate,
  buildSavedAlertPayload,
  buildSavedPriceUpdate,
  buildSavedRvPayload,
} from './payloads';

function mapDoc<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  // Equivalent of ServerTimestampBehavior.ESTIMATE for pending writes.
  const data = snap.data({ serverTimestamps: 'estimate' });
  return { ...data, id: snap.id } as T;
}

const createdSeconds = (r: { createdAt?: TimestampLike | null }) => r.createdAt?.seconds ?? 0;
const sortNewest = <T extends { createdAt?: TimestampLike | null }>(list: T[]) =>
  [...list].sort((a, b) => createdSeconds(b) - createdSeconds(a));

type Unsubscribe = () => void;

export class MatchRvFirestoreRepository {
  constructor(private readonly db: Firestore) {}

  private col(uid: string, name: string) {
    return collection(this.db, 'users', uid, name);
  }

  private observe<T extends { createdAt?: TimestampLike | null }>(
    uid: string,
    name: string,
    onData: (items: T[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      this.col(uid, name),
      (snap) => onData(sortNewest(snap.docs.map((d) => mapDoc<T>(d)))),
      (err) => {
        if (__DEV__) console.warn(`Firestore stream error users/${uid}/${name}`, err);
        onError(err);
      },
    );
  }

  observeSavedRvs(uid: string, onData: (r: SavedRvRecord[]) => void, onError: (e: Error) => void) {
    return this.observe<SavedRvRecord>(uid, 'saved_rvs', onData, onError);
  }
  observeSavedAlerts(uid: string, onData: (r: SavedSearchAlertRecord[]) => void, onError: (e: Error) => void) {
    return this.observe<SavedSearchAlertRecord>(uid, 'saved_alerts', onData, onError);
  }
  observeInquiries(uid: string, onData: (r: DealerInquiryRecord[]) => void, onError: (e: Error) => void) {
    return this.observe<DealerInquiryRecord>(uid, 'inquiries', onData, onError);
  }

  async saveRv(uid: string, rv: RvSummary, detail?: RvDetail | null): Promise<void> {
    const docId = sanitizeFirestoreDocId(rv.unitId);
    await setDoc(doc(this.col(uid, 'saved_rvs'), docId), buildSavedRvPayload(uid, rv, detail, serverTimestamp()));
  }

  async updateSavedRvPrice(uid: string, savedId: string, lastCheckedPriceUsd: number, hasPriceDrop: boolean, imageUrl?: string | null) {
    await updateDoc(
      doc(this.col(uid, 'saved_rvs'), savedId),
      buildSavedPriceUpdate(lastCheckedPriceUsd, hasPriceDrop, imageUrl, serverTimestamp()),
    );
  }

  async removeSavedRv(uid: string, savedId: string) {
    await deleteDoc(doc(this.col(uid, 'saved_rvs'), savedId));
  }

  async saveSearchAlert(uid: string, filter: RvSearchFilter, initialUnitIds: string[], customLabel?: string | null) {
    const ref = doc(this.col(uid, 'saved_alerts')); // auto-id like Kotlin .document()
    await setDoc(ref, buildSavedAlertPayload(uid, filter, initialUnitIds, serverTimestamp(), customLabel));
  }

  async toggleSearchAlert(uid: string, alertId: string, enabled: boolean) {
    await updateDoc(doc(this.col(uid, 'saved_alerts'), alertId), { alertsEnabled: enabled, updatedAt: serverTimestamp() });
  }

  async updateAlertCheckResult(uid: string, alertId: string, update: AlertCheckUpdate) {
    await updateDoc(doc(this.col(uid, 'saved_alerts'), alertId), { ...update, updatedAt: serverTimestamp() });
  }

  async deleteSearchAlert(uid: string, alertId: string) {
    await deleteDoc(doc(this.col(uid, 'saved_alerts'), alertId));
  }

  async recordDealerInquiry(uid: string, input: Parameters<typeof buildInquiryPayload>[1]) {
    const docId = sanitizeFirestoreDocId(input.mcpInquiryId);
    await setDoc(doc(this.col(uid, 'inquiries'), docId), buildInquiryPayload(uid, input, serverTimestamp()));
  }

  async updateInquiryStatus(uid: string, inquiryDocId: string, status: string, dealerReply?: string | null) {
    await updateDoc(doc(this.col(uid, 'inquiries'), inquiryDocId), buildInquiryStatusUpdate(status, dealerReply, serverTimestamp()));
  }

  /** Best-effort; never throws (analytics must not break UX). */
  async trackAnalyticsEvent(
    uid: string | null | undefined,
    eventType: AnalyticsEventType,
    extra: Parameters<typeof buildAnalyticsPayload>[2] = {},
  ): Promise<void> {
    if (!uid) return;
    try {
      await setDoc(doc(this.col(uid, 'analytics_events')), buildAnalyticsPayload(uid, eventType, extra, serverTimestamp()));
    } catch (e) {
      if (__DEV__) console.warn('analytics event failed', e);
    }
  }
}
