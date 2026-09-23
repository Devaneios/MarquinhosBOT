import { health } from '@marquinhos/contracts/http/routes/health';
import express from 'express';
import { sendContract } from 'utils/contract';

const router = express.Router();

router.get('/', (_req, res) => sendContract(res, health, { status: 'ok' }));

export default router;
