const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);

router.get('/bots', asyncHandler(controller.listBots));
router.post('/bots', asyncHandler(controller.createBot));
router.put('/bots/:botId', asyncHandler(controller.updateBot));
router.get('/users', asyncHandler(controller.listUsers));
router.get('/users/:userId/purchases', asyncHandler(controller.userPurchases));
router.post('/purchases/:purchaseId/mark-paid', asyncHandler(controller.markPurchasePaid));
router.get('/settings', asyncHandler(controller.getSettings));
router.post('/settings', asyncHandler(controller.updateSetting));
router.post('/users/:userId/reset-progress', asyncHandler(controller.resetUserProgress));

module.exports = router;
