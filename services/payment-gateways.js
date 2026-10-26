const crypto = require("crypto");

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const REQUEST_TIMEOUT_MS = 15_000;

const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
// Keep Razorpay as the default single gateway; PayPal is an optional add-on.
const isPayPalConfigured = () =>
  process.env.PAYPAL_ENABLED === "true" && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

const readJsonResponse = async (response, provider) => {
  const body = await response.json();
  if (!response.ok) {
    const detail = body.error_description || body.error?.description || body.message || response.statusText;
    throw new Error(`${provider} request failed (${response.status}): ${detail}`);
  }
  return body;
};

const createRazorpayOrder = async ({ amount, receipt, orderId }) => {
  if (!isRazorpayConfigured()) throw new Error("Razorpay is not configured. Add its API keys to the environment.");
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      notes: { orderId: String(orderId) },
    }),
  });
  return readJsonResponse(response, "Razorpay");
};

const getRazorpayPayment = async (paymentId) => {
  if (!isRazorpayConfigured()) throw new Error("Razorpay is not configured.");
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readJsonResponse(response, "Razorpay");
};

const getRazorpayOrderPayments = async (orderId) => {
  if (!isRazorpayConfigured()) throw new Error("Razorpay is not configured.");
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readJsonResponse(response, "Razorpay");
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!process.env.RAZORPAY_KEY_SECRET || typeof signature !== "string") return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

const getPayPalAccessToken = async () => {
  if (!isPayPalConfigured()) throw new Error("PayPal is not configured. Add its client credentials to the environment.");
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const result = await readJsonResponse(response, "PayPal");
  return result.access_token;
};

const createPayPalOrder = async ({ amount, orderNumber, orderId, cancelToken, baseUrl }) => {
  const accessToken = await getPayPalAccessToken();
  const callbackBaseUrl = String(baseUrl).replace(/\/+$/, "");
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: String(orderId),
        custom_id: String(orderId),
        invoice_id: orderNumber,
        amount: { currency_code: "INR", value: Number(amount).toFixed(2) },
      }],
      application_context: {
        return_url: `${callbackBaseUrl}/payments/paypal/capture`,
        cancel_url: `${callbackBaseUrl}/payments/paypal/cancel?order=${encodeURIComponent(orderId)}&state=${encodeURIComponent(cancelToken)}`,
        user_action: "PAY_NOW",
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const result = await readJsonResponse(response, "PayPal");
  const approval = result.links?.find((link) => link.rel === "approve" || link.rel === "payer-action");
  if (!result.id || !approval?.href) throw new Error("PayPal did not return an approval URL.");
  return { id: result.id, approvalUrl: approval.href };
};

const getPayPalOrder = async (orderId) => {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readJsonResponse(response, "PayPal");
};

const capturePayPalOrder = async (orderId) => {
  const current = await getPayPalOrder(orderId);
  if (current.status === "COMPLETED") return current;

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readJsonResponse(response, "PayPal");
};

const getPayPalCapturedAmount = (captureResult) => {
  const unit = captureResult.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((item) => item.status === "COMPLETED");
  return {
    orderId: unit?.custom_id || unit?.reference_id || "",
    currency: capture?.amount?.currency_code || unit?.amount?.currency_code || "",
    amount: Number(capture?.amount?.value || unit?.amount?.value || 0),
    captureId: capture?.id || "",
  };
};

module.exports = {
  isRazorpayConfigured,
  isPayPalConfigured,
  createRazorpayOrder,
  getRazorpayPayment,
  getRazorpayOrderPayments,
  verifyRazorpaySignature,
  createPayPalOrder,
  getPayPalOrder,
  capturePayPalOrder,
  getPayPalCapturedAmount,
};
