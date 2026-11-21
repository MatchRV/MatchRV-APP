const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

function pastDate(msAgo = 2000) {
  return new Date(Date.now() - msAgo);
}

test("Unauthenticated users cannot read or write any collection", async () => {
  const unauth = testEnv.unauthenticatedContext().firestore();
  const now = pastDate();

  await assertFails(
    unauth.collection("users").doc(ALICE_UID).collection("saved_rvs").get()
  );
  await assertFails(
    unauth
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_rvs")
      .doc("vin_123")
      .set({
        userId: ALICE_UID,
        unitId: "vin:123",
        title: "2026 Flagstaff MAC",
        make: "Forest River",
        rvType: "popup_camper",
        dealerName: "Colman's Country Campers",
        dealerState: "IL",
        savedPriceUsd: 7999,
        lastCheckedPriceUsd: 7999,
        hasPriceDrop: false,
        createdAt: now,
        updatedAt: now,
      })
  );
  await assertFails(
    unauth.collection("users").doc(ALICE_UID).collection("inquiries").get()
  );
});

test("Saved RVs: owner create, list, partial price-drop update, and cross-user denial", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const created = pastDate(10000);

  const ref = aliceDb
    .collection("users")
    .doc(ALICE_UID)
    .collection("saved_rvs")
    .doc("vin_4X4CFS415TD323249");

  await assertSucceeds(
    ref.set({
      userId: ALICE_UID,
      unitId: "vin:4X4CFS415TD323249",
      title: "2026 Forest River Flagstaff MAC 141OTG",
      make: "Forest River",
      rvType: "popup_camper",
      dealerName: "Colman's Country Campers, Hartford, IL",
      dealerState: "IL",
      savedPriceUsd: 7999,
      lastCheckedPriceUsd: 7999,
      hasPriceDrop: false,
      imageUrl: "https://static.overfuel.com/photos/example.webp",
      sleeps: 6,
      lengthFt: 17.2,
      createdAt: created,
      updatedAt: created,
    })
  );

  // List subcollection succeeds for owner, fails for Bob
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("saved_rvs").get()
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("saved_rvs").get()
  );
  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_rvs")
      .doc("vin_4X4CFS415TD323249")
      .get()
  );

  // Valid partial update (price drop + notes)
  await assertSucceeds(
    ref.update({
      lastCheckedPriceUsd: 7499,
      hasPriceDrop: true,
      notes: "Great price drop!",
      updatedAt: pastDate(1000),
    })
  );

  // Reject immutable field mutation (createdAt)
  await assertFails(
    ref.update({
      createdAt: pastDate(500),
      updatedAt: pastDate(500),
    })
  );

  // Reject ghost field ("id" or "isVerified")
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_rvs")
      .doc("vin_extra")
      .set({
        id: "vin_extra",
        userId: ALICE_UID,
        unitId: "vin:extra",
        title: "Ghost ID Test",
        make: "Winnebago",
        rvType: "class_c",
        dealerName: "Dealer",
        dealerState: "TX",
        savedPriceUsd: 55000,
        lastCheckedPriceUsd: 55000,
        hasPriceDrop: false,
        createdAt: created,
        updatedAt: created,
      })
  );

  // Reject future timestamp
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_rvs")
      .doc("vin_future")
      .set({
        userId: ALICE_UID,
        unitId: "vin:future",
        title: "Future Test",
        make: "Winnebago",
        rvType: "class_c",
        dealerName: "Dealer",
        dealerState: "TX",
        savedPriceUsd: 55000,
        lastCheckedPriceUsd: 55000,
        hasPriceDrop: false,
        createdAt: new Date(Date.now() + 60000),
        updatedAt: new Date(Date.now() + 60000),
      })
  );

  // Owner delete succeeds, Bob delete fails
  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_rvs")
      .doc("vin_4X4CFS415TD323249")
      .delete()
  );
  await assertSucceeds(ref.delete());
});

test("Saved Search Alerts: owner create, toggle, refresh update, and isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const created = pastDate(10000);

  const alertRef = aliceDb
    .collection("users")
    .doc(ALICE_UID)
    .collection("saved_alerts")
    .doc("alert_1");

  await assertSucceeds(
    alertRef.set({
      userId: ALICE_UID,
      label: "Class C under $60k near Austin, TX",
      alertsEnabled: true,
      matchCount: 6,
      newMatchCount: 0,
      rvTypes: ["class_c"],
      priceMaxUsd: 60000,
      location: "Austin, TX",
      radiusMiles: 200,
      lastCheckedUnitIds: ["vin:111", "vin:222"],
      createdAt: created,
      updatedAt: created,
    })
  );

  await assertSucceeds(
    alertRef.update({
      alertsEnabled: false,
      updatedAt: pastDate(1000),
    })
  );

  await assertSucceeds(
    alertRef.update({
      matchCount: 8,
      newMatchCount: 2,
      lastCheckedUnitIds: ["vin:111", "vin:222", "vin:333"],
      updatedAt: pastDate(500),
    })
  );

  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("saved_alerts")
      .doc("alert_1")
      .update({ alertsEnabled: false, updatedAt: pastDate(500) })
  );
});

test("Dealer Inquiries: create, status update, enum validation, and cross-user denial", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const created = pastDate(10000);

  const ref = aliceDb
    .collection("users")
    .doc(ALICE_UID)
    .collection("inquiries")
    .doc("inq_001");

  await assertSucceeds(
    ref.set({
      userId: ALICE_UID,
      mcpInquiryId: "inq_abc123",
      statusToken: "tok_secret_xyz",
      unitId: "vin:4X4CFS415TD323249",
      rvTitle: "2026 Forest River Flagstaff MAC 141OTG",
      dealerName: "Colman's Country Campers",
      dealerLocation: "Hartford, IL",
      status: "queued_for_matchrv",
      message: "Is this unit still in stock and what is the out-the-door price?",
      dryRun: false,
      priceUsd: 7999,
      createdAt: created,
      updatedAt: created,
    })
  );

  await assertSucceeds(
    ref.update({
      status: "replied",
      dealerReply: "Yes, still on our lot! Ask for Sam.",
      updatedAt: pastDate(1000),
    })
  );

  // Invalid status enum rejected
  await assertFails(
    ref.update({
      status: "hacked_status",
      updatedAt: pastDate(500),
    })
  );

  // Immutable statusToken cannot be modified
  await assertFails(
    ref.update({
      statusToken: "new_token",
      status: "delivered",
      updatedAt: pastDate(500),
    })
  );

  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("inquiries").get()
  );
});

test("Analytics Events: create allowed, update forbidden, enum enforced", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const created = pastDate(2000);

  const ref = aliceDb
    .collection("users")
    .doc(ALICE_UID)
    .collection("analytics_events")
    .doc("evt_1");

  await assertSucceeds(
    ref.set({
      userId: ALICE_UID,
      eventType: "agent_search",
      queryText: "Class C under $60k within 200 miles",
      createdAt: created,
    })
  );

  // Analytics events are append-only (no updates)
  await assertFails(
    ref.update({
      eventType: "save",
    })
  );

  // Unknown event type fails
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("analytics_events")
      .doc("evt_bad")
      .set({
        userId: ALICE_UID,
        eventType: "unknown_event",
        createdAt: created,
      })
  );
});
