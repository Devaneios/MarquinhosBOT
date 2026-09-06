import AuthController from 'controllers/auth.controller';
import express from 'express';

const router = express.Router();
const auth = new AuthController();

router.get('/login', auth.login.bind(auth));
router.get('/refresh_token', auth.refreshToken.bind(auth));
router.get('/discordLoginUrl', auth.discordLoginUrl.bind(auth));
router.get('/lastfmLoginUrl', auth.lastfmLoginUrl.bind(auth));

export default router;
