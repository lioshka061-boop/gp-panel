const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { listBots, botAccess, updateProgress, resetProgress } = require('../controllers/botController');

router.get('/', requireAuth, asyncHandler(listBots));
router.get('/:botId/access', requireAuth, asyncHandler(botAccess));
router.post('/:botId/progress', requireAuth, asyncHandler(updateProgress));
router.post('/:botId/reset', requireAuth, asyncHandler(resetProgress));

module.exports = router;
