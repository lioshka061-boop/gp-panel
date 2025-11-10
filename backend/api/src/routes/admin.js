const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  listBots,
  createBot,
  updateBot,
  listUsers,
  userPurchases,
  markPurchasePaid,
  getSettings,
  updateSetting,
  resetUserProgress,
  getAnalyticsOverview,
  getUserAnalytics,
} = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);

router.get('/bots', asyncHandler(listBots));
router.post('/bots', asyncHandler(createBot));
router.put('/bots/:botId', asyncHandler(updateBot));
router.get('/users', asyncHandler(listUsers));
router.get('/users/:userId/purchases', asyncHandler(userPurchases));
router.post('/purchases/:purchaseId/mark-paid', asyncHandler(markPurchasePaid));
router.get('/settings', asyncHandler(getSettings));
router.post('/settings', asyncHandler(updateSetting));
router.post('/users/:userId/reset-progress', asyncHandler(resetUserProgress));
router.get('/analytics/overview', asyncHandler(getAnalyticsOverview));
router.get('/users/:userId/analytics', asyncHandler(getUserAnalytics));

module.exports = router;
