const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { register, login, me, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(me));
router.post('/logout', requireAuth, asyncHandler(logout));

module.exports = router;
