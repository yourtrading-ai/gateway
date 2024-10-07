/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/ban-types */
import { Request, Response, Router } from 'express';
import { asyncHandler } from '../services/error-handler';
import { getAccount } from './mango.controllers';
import { MangoAccountRequest, MangoAccountResponse } from './mango.requests';

export namespace MangoRoutes {
  export const router = Router();

  router.get(
    '/account',
    asyncHandler(
      async (
        req: Request<{}, {}, MangoAccountRequest>,
        res: Response<MangoAccountResponse | string, {}>,
      ) => {
        res
          .status(200)
          .json(await getAccount(req.query as unknown as MangoAccountRequest));
      },
    ),
  );
}
