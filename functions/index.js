const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

admin.initializeApp();

exports.sendPushNotification = onDocumentCreated(
  'families/{familyCode}/notifications/{notifId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const { title, body, forRole, fromUid } = snap.data();
    if (!title) return;

    const familyCode = event.params.familyCode;
    const tokensSnap = await admin.firestore()
      .collection('families').doc(familyCode)
      .collection('pushTokens').get();

    const tokens = [];
    tokensSnap.forEach(doc => {
      const data = doc.data();
      if (doc.id === fromUid) return;
      if (forRole === 'both' || data.role === forRole) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) return;

    const message = {
      notification: { title, body: body || '' },
      tokens
    };

    const result = await admin.messaging().sendEachForMulticast(message);

    const failed = [];
    result.responses.forEach((resp, i) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        failed.push(tokens[i]);
      }
    });

    if (failed.length > 0) {
      const batch = admin.firestore().batch();
      tokensSnap.forEach(doc => {
        if (failed.includes(doc.data().token)) {
          batch.delete(doc.ref);
        }
      });
      await batch.commit();
    }
  }
);
