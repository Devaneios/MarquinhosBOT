import AuthController from 'controllers/auth.controller';
import express from 'express';

export function createAuthRouter(auth = new AuthController()) {
  const router = express.Router();

  router.get('/login', auth.login.bind(auth));
  router.get('/refresh_token', auth.refreshToken.bind(auth));
  router.get('/discordLoginUrl', auth.discordLoginUrl.bind(auth));
  router.get('/lastfmLoginUrl', auth.lastfmLoginUrl.bind(auth));

  return router;
}

export default createAuthRouter();
