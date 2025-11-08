const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config/env');

function buildSignature(parts) {
  const payload = parts.join(';');
  return crypto.createHmac('md5', config.wayforpay.secretKey).update(payload).digest('hex');
}

async function createInvoice({ orderReference, orderDate, bot, user, amount, currency }) {
  const resolvedAmount = Number(
    Number.isFinite(amount) ? amount : Number(bot.price)
  );
  const resolvedCurrency = currency || bot.currency || 'UAH';
  const payload = {
    transactionType: 'CREATE_INVOICE',
    merchantAccount: config.wayforpay.merchantAccount,
    merchantDomainName: config.wayforpay.domain,
    orderReference,
    orderDate,
    amount: resolvedAmount,
    currency: resolvedCurrency,
    productName: [`Bot: ${bot.name}`],
    productCount: [1],
    productPrice: [resolvedAmount],
    serviceUrl: config.wayforpay.serviceUrl,
    returnUrl: config.wayforpay.returnUrl,
    clientEmail: user.email,
    clientPhone: user.phone,
  };

  payload.merchantSignature = buildSignature([
    payload.merchantAccount,
    payload.merchantDomainName,
    payload.orderReference,
    payload.orderDate,
    payload.amount,
    payload.currency,
    payload.productName[0],
    payload.productCount[0],
    payload.productPrice[0],
  ]);

  const response = await axios.post(config.wayforpay.apiUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

function validateCallbackSignature(body) {
  const fields = [
    body.merchantAccount,
    body.orderReference,
    body.amount,
    body.currency,
    body.authCode,
    body.cardPan,
    body.transactionStatus,
    body.reasonCode,
  ].map((field) => field || '');
  const expected = buildSignature(fields);
  return expected === body.merchantSignature;
}

function callbackResponse(orderReference, status, reasonCode = 1100) {
  const time = Math.floor(Date.now() / 1000);
  const signature = buildSignature([
    config.wayforpay.merchantAccount,
    orderReference,
    time,
    status,
    reasonCode,
  ]);
  return {
    orderReference,
    status,
    time,
    signature,
    reason: status,
    reasonCode,
  };
}

module.exports = { createInvoice, validateCallbackSignature, callbackResponse };
