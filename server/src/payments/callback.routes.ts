import { Router, raw } from 'express';
import { env, isNaloPayConfigured } from '../config/env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import * as consultationsService from '../modules/consultations/consultations.service.js';
import * as subscriptionsService from '../modules/subscriptions/subscriptions.service.js';
import * as walletService from '../modules/wallet/wallet.service.js';
import { verifyCallbackSignature } from './nalopay.js';

/**
 * NaloPay signs the compact JSON body. This route must see the raw bytes —
 * express.json() would re-serialize and break HMAC verification.
 *
 * One webhook covers consultation fees and lawyer plan payments. The HMAC is
 * checked once, then each module looks up the reference.
 */
export const paymentsCallbackRouter = Router();

paymentsCallbackRouter.post(
  '/callback',
  raw({ type: 'application/json', limit: '100kb' }),
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature = req.header('nalopay-signature') ?? '';

    if (!isNaloPayConfigured || !env.NALOPAY_MERCHANT_SECRET_KEY) {
      throw unauthorized('Payment callback is not configured');
    }

    if (!verifyCallbackSignature(rawBody, signature, env.NALOPAY_MERCHANT_SECRET_KEY)) {
      throw unauthorized('Invalid payment signature');
    }

    let payload: {
      order_id?: string;
      status?: string;
      amount?: string | number;
      reference?: string;
    };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      throw badRequest('Payment callback body is not valid JSON');
    }

    const handled =
      (await consultationsService.capturePaidCallback(payload)) ||
      (await subscriptionsService.capturePaidCallback(payload)) ||
      (await walletService.capturePayoutCallback(payload));

    if (!handled) log.payment.info('callback for unknown order');

    res.status(200).json({ received: true });
  }),
);
