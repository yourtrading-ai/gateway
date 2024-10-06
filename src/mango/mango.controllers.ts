/* eslint-disable prettier/prettier */
import { MangoAccount } from '@blockworks-foundation/mango-v4';
import { latency } from '../services/base';
import {
  getInitializedChain,
  getConnector,
} from '../services/connection-manager';
import { MangoAccountRequest, MangoAccountResponse } from './mango.requests';

/**
 * GET /mango/getAccount
 *
 * @param request
 */
export async function getAccount(
  request: MangoAccountRequest,
): Promise<MangoAccountResponse> {
  const startTimestamp: number = Date.now();
  await getInitializedChain(request.chain, request.network);
  const connector: any = await getConnector(
    request.chain,
    request.network,
    request.connector,
  );
  const result: MangoAccount = await connector.getMangoAccount(
    request.botWallet,
    null,
  );
  return {
    network: request.network,
    timestamp: startTimestamp,
    latency: latency(startTimestamp, Date.now()),
    account: result,
  };
}
