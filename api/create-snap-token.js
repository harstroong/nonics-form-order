/*
 * Vercel Serverless Function: create-snap-token
 * POST /api/create-snap-token
 *
 * Body:
 * {
 *   orderId, productId, productName, productPrice,
 *   customerEmail, customerName, customerWa,
 *   enabledPayments: ["qris"], paymentChannel: "qris", paymentChannelLabel: "QRIS"
 * }
 *
 * Response: { token, redirect_url }
 *
 * Environment variables (set di Vercel Project Settings → Environment Variables):
 *   MIDTRANS_SERVER_KEY   = SB-Mid-server-XXXX (sandbox) atau Mid-server-XXXX (production)
 *   MIDTRANS_CLIENT_KEY   = SB-Mid-client-XXXX (sandbox) atau Mid-client-XXXX (production)
 *   MIDTRANS_IS_PRODUCTION = "true" atau "false"
 */

const midtransClient = require('midtrans-client');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      orderId, productId, productName, productPrice,
      customerEmail, customerName, customerWa,
      enabledPayments, paymentChannel, paymentChannelLabel
    } = body;

    if (!orderId || !productName || !productPrice || !customerEmail || !customerName) {
      return res.status(400).json({ error: 'Missing required fields (orderId, productName, productPrice, customerEmail, customerName)' });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;
    const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true';

    if (!serverKey || !clientKey) {
      return res.status(500).json({
        error: 'Midtrans config not set. Set env vars MIDTRANS_SERVER_KEY + MIDTRANS_CLIENT_KEY di Vercel Project Settings.'
      });
    }

    const snap = new midtransClient.Snap({ isProduction, serverKey, clientKey });

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(productPrice, 10)
      },
      item_details: [{
        id: String(productId || 'unknown'),
        price: parseInt(productPrice, 10),
        quantity: 1,
        name: String(productName).substring(0, 50)
      }],
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerWa || ''
      }
    };

    // NOTE: enabled_payments filter di-disable — banyak akun Midtrans sandbox
    // gak punya semua channel aktif (contoh: QRIS/GoPay perlu aktivasi manual).
    // Jadi kita let Snap tampilkan semua metode yang tersedia di akun,
    // customer pilih dari Snap popup. Grid di frontend jadi visual preview aja.
    //
    // Kalau lo mau enforce single method setelah semua channel aktif di Midtrans,
    // uncomment 3 baris di bawah:
    //
    // if (Array.isArray(enabledPayments) && enabledPayments.length) {
    //   parameter.enabled_payments = enabledPayments;
    // }

    const transaction = await snap.createTransaction(parameter);

    return res.status(200).json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      paymentChannel: paymentChannel || '',
      paymentChannelLabel: paymentChannelLabel || ''
    });
  } catch (err) {
    console.error('[create-snap-token] Error:', err);
    return res.status(500).json({ error: (err && err.message) || 'Internal error' });
  }
};
