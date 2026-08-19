/*
 * Vercel Serverless Function: midtrans-webhook
 * POST /api/midtrans-webhook
 *
 * Dipanggil otomatis oleh Midtrans setiap kali status transaksi berubah
 * (payment success, expire, cancel, dsb).
 *
 * Setelah lo deploy, catat URL webhook:
 *   https://<domain-vercel-lo>.vercel.app/api/midtrans-webhook
 *
 * Terus set di Midtrans Dashboard:
 *   Settings → Configuration → Payment Notification URL → paste URL di atas
 *
 * Environment variables:
 *   MIDTRANS_SERVER_KEY = SB-Mid-server-XXXX
 *   FIREBASE_PROJECT_ID = <nama project firebase lo> (untuk update order status ke Firestore)
 */

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id
    } = body;

    // Verifikasi signature — WAJIB. Kalau ga match, request ini kemungkinan spoofed.
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error('[webhook] MIDTRANS_SERVER_KEY not set');
      return res.status(500).json({ error: 'Server config missing' });
    }

    const expectedSig = crypto
      .createHash('sha512')
      .update(String(order_id) + String(status_code) + String(gross_amount) + serverKey)
      .digest('hex');

    if (signature_key !== expectedSig) {
      console.warn('[webhook] Invalid signature untuk order', order_id);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Map Midtrans transaction_status → status internal lo
    let newStatus = 'pending';
    if ((transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement') {
      newStatus = 'paid';
    } else if (
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire' ||
      transaction_status === 'failure'
    ) {
      newStatus = 'failed';
    } else if (transaction_status === 'pending') {
      newStatus = 'pending';
    }

    // Update Firestore via REST API (rules lo open write untuk od_orders_digital)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (projectId) {
      const fields = {
        status: { stringValue: newStatus },
        midtransTxId: { stringValue: transaction_id || '' },
        paymentType: { stringValue: payment_type || '' },
        webhookAt: { integerValue: String(Date.now()) }
      };
      if (newStatus === 'paid') {
        fields.paidAt = { integerValue: String(Date.now()) };
      }
      const updateMask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/od_orders_digital/${order_id}?${updateMask}`;

      const fbRes = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!fbRes.ok) {
        const errText = await fbRes.text();
        console.warn('[webhook] Firestore update failed:', fbRes.status, errText);
      }
    } else {
      console.warn('[webhook] FIREBASE_PROJECT_ID not set — skip Firestore update');
    }

    console.log('[webhook] Order', order_id, '→', newStatus, '(midtrans:', transaction_status + ')');
    return res.status(200).json({ ok: true, status: newStatus });
  } catch (err) {
    console.error('[webhook] Error:', err);
    return res.status(500).json({ error: (err && err.message) || 'Internal error' });
  }
};
