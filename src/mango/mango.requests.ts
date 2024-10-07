import { MangoAccount } from '@blockworks-foundation/mango-v4';
import { NetworkSelectionRequest } from '../services/common-interfaces';

export interface MangoAccountRequest extends NetworkSelectionRequest {
  botWallet: string;
}

export interface MangoAccountResponse {
  network: string;
  timestamp: number;
  latency: number;
  account: MangoAccount;
}
