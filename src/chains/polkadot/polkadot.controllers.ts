import { Polkadot } from './polkadot';
import { PolkadotBalanceRequest, PolkadotPollRequest } from './polkadot.requests';
import { tokenValueToString } from '../../services/base';
import {
  HttpException,
  TOKEN_NOT_SUPPORTED_ERROR_CODE,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../services/error-handler';
import {
  validatePolkadotBalanceRequest,
  validatePolkadotPollRequest,
} from './polkadot.validators';
import { PolkadotTokenValue } from './polkadot-base';

export const toPolkadotBalances = (
  balances: Record<string, PolkadotTokenValue>,
  tokenSymbols: Array<string>
): Record<string, string> => {
  const walletBalances: Record<string, string> = {};

  tokenSymbols.forEach((symbol) => {
    let balance = '0.0';

    if (balances[symbol]) {
      balance = tokenValueToString(balances[symbol]);
    }

    walletBalances[symbol] = balance;
  });

  return walletBalances;
};

export class PolkadotController {
  static async balances(polkadotish: Polkadot, req: PolkadotBalanceRequest) {
    validatePolkadotBalanceRequest(req);

    const wallet = await polkadotish.getWallet(req.address);
    const { tokenSymbols } = req;

    tokenSymbols.forEach((symbol: string) => {
      const token = polkadotish.getTokenForSymbol(symbol);

      if (!token) {
        throw new HttpException(
          500,
          TOKEN_NOT_SUPPORTED_ERROR_MESSAGE + symbol,
          TOKEN_NOT_SUPPORTED_ERROR_CODE
        );
      }
    });

    const balances = await polkadotish.getBalances(wallet);
    const filteredBalances = toPolkadotBalances(balances, tokenSymbols);

    return {
      balances: filteredBalances,
    };
  }

  static async poll(polkadot: Polkadot, req: PolkadotPollRequest) {
    validatePolkadotPollRequest(req);

    const transaction = await polkadot.getTransaction(req.txHash);
    const currentBlock = await polkadot.getCurrentBlockNumber();

    return {
      txHash: req.txHash,
      currentBlock,
      txBlock: transaction.block.header.number.toNumber(),
      status: transaction.status,
      events: transaction.events,
    };
  }
} 