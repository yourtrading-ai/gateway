import { ExtrinsicStatus } from '@polkadot/types/interfaces';

export interface PolkadotBalanceRequest {
  address: string;  // the user's Polkadot address (SS58 format)
  tokenSymbols: string[];  // a list of token symbols
}

export interface PolkadotBalanceResponse {
  network: string;
  timestamp: number;
  latency: number;
  balances: Record<string, string>;
}

export interface PolkadotTokenRequest {
  address: string;
  token: string;
}

export interface PolkadotPollRequest {
  txHash: string;
}

export enum TransactionResponseStatusCode {
  FAILED = -1,
  CONFIRMED = 1,
}

export interface PolkadotPollResponse {
  network: string;
  timestamp: number;
  txHash: string;
  currentBlock: number;
  txBlock: number;
  status: ExtrinsicStatus;
  events: any[];
} 