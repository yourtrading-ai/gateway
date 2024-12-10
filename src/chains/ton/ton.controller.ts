import {
  TonAsset,
  AssetsRequest,
  AssetsResponse,
  // OptInRequest,
  // PollRequest,
  // PollResponse,
} from './ton.requests';
import { Ton } from './ton';
// import { BalanceRequest } from '../../network/network.requests';
// import {
//   HttpException,
//   TOKEN_NOT_SUPPORTED_ERROR_CODE,
//   TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
// } from '../../services/error-handler';
import {
  // validateTonBalanceRequest,
  // validateTonPollRequest,
  validateAssetsRequest,
  // validateOptInRequest,
} from './ton.validators';

// async function getInitializedTon(network: string): Promise<Ton> {
//   const ton = Ton.getInstance(network);
//
//   if (!ton.ready()) {
//     await ton.init();
//   }
//
//   return ton;
// }

export class TonController {
  // static async poll(
  //   ton: Ton,
  //   req: PollRequest
  // ): Promise<PollResponse> {
  //   validateTonPollRequest(req);
  //
  //   return await ton.getTransaction(req.txHash);
  // }

  // static async balances(chain: Ton, request: BalanceRequest) {
  //   validateTonBalanceRequest(request);
  //
  //   const balances: Record<string, string> = {};
  //
  //   const account = await chain.getAccountFromAddress(request.address);
  //
  //   if (request.tokenSymbols.includes(chain.nativeTokenSymbol)) {
  //     balances[chain.nativeTokenSymbol] = await chain.getNativeBalance(account);
  //   }
  //
  //   for (const token of request.tokenSymbols) {
  //     if (token === chain.nativeTokenSymbol) continue;
  //     balances[token] = await chain.getAssetBalance(account, token);
  //   }
  //
  //   return {
  //     balances: balances,
  //   };
  // }

  static async getTokens(
    ton: Ton,
    request: AssetsRequest
  ): Promise<AssetsResponse> {
    validateAssetsRequest(request);

    let assets: TonAsset[] = [];

    if (!request.assetSymbols) {
      assets = ton.storedAssetList;
    } else {
      let assetSymbols;
      if (typeof request.assetSymbols === 'string') {
        assetSymbols = [request.assetSymbols];
      } else {
        assetSymbols = request.assetSymbols;
      }
      for (const a of assetSymbols as []) {
        assets.push(ton.getAssetForSymbol(a) as TonAsset);
      }
    }

    return {
      assets: assets,
    };
  }

  // static async approve(request: OptInRequest) {
  //   validateOptInRequest(request);
  //
  //   const ton = await getInitializedTon(request.network);
  //   const asset = ton.getAssetForSymbol(request.assetSymbol);
  //
  //   if (asset === undefined) {
  //     throw new HttpException(
  //       500,
  //       TOKEN_NOT_SUPPORTED_ERROR_MESSAGE + request.assetSymbol,
  //       TOKEN_NOT_SUPPORTED_ERROR_CODE
  //     );
  //   }
  //
  //   const transactionResponse = await ton.optIn(
  //     request.address,
  //     request.assetSymbol
  //   );
  //
  //   return {
  //     assetId: (asset as TonAsset).assetId,
  //     transactionResponse: transactionResponse,
  //   };
  // }
}
