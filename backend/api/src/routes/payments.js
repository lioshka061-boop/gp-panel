const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { createPayment, wayforpayCallback, listMyPurchases } = require('../controllers/paymentsController');

router.post('/create', requireAuth, asyncHandler(createPayment));
router.post('/wayforpay-callback', express.json(), asyncHandler(wayforpayCallback));
router.get('/my', requireAuth, asyncHandler(listMyPurchases));

module.exports = router;
