import { Polkadot } from './polkadot';
import { NextFunction, Request, Response } from 'express';
import { PolkadotConfig } from './polkadot.config';

export const verifyPolkadotIsAvailable = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  const polkadot = Polkadot.getInstance(PolkadotConfig.config.network.name);
  if (!polkadot.ready()) {
    await polkadot.init();
  }
  return next();
}; 