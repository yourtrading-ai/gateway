import BN from 'bn.js';
import LRUCache from 'lru-cache';
import { Solana } from '../../chains/solana/solana';
import { getSolanaConfig } from '../../chains/solana/solana.config';
import {
  PerpClobDeleteOrderRequest,
  PerpClobFundingPaymentsRequest,
  PerpClobGetOrderRequest,
  PerpClobGetTradesRequest,
  PerpClobMarketRequest,
  PerpClobMarkets,
  PerpClobOrderbookRequest,
  PerpClobPositionRequest,
  PerpClobPostOrderRequest,
  PerpClobTickerRequest,
  PerpClobGetLastTradePriceRequest,
  PerpClobBatchUpdateRequest,
  ClobDeleteOrderRequestExtract,
  CreatePerpOrderParam,
  Orderbook,
  extractPerpOrderParams,
} from '../../clob/clob.requests';
import { NetworkSelectionRequest } from '../../services/common-interfaces';
import { MangoConfig } from './mango.config';
import {
  MangoClient,
  PerpMarket,
  Group,
  BookSide,
  MangoAccount,
  PerpMarketIndex,
  PerpPosition,
} from '@blockworks-foundation/mango-v4';
import {
  FundingPayment,
  OneHourFundingRate,
  PerpMarketFills,
  PerpTradeActivity,
} from './mango.types';
import { translateOrderSide, translateOrderType } from './mango.utils';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import Dict = NodeJS.Dict;
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { mangoDataApi, MangoDataApi } from './mango.api';

export class MangoClobPerp {
  private static _instances: LRUCache<string, MangoClobPerp>;
  private readonly _chain: Solana;
  private readonly _client: MangoClient;
  public derivativeApi: MangoDataApi;
  public mangoGroup: Group;
  public conf: MangoConfig.NetworkConfig;

  private _ready: boolean = false;
  private _lastTradePrice: number = 0;
  public parsedMarkets: PerpClobMarkets<PerpMarket> = {};
  // @note: Contains all MangoAccounts, grouped by owner address and base asset
  public mangoAccounts: Dict<Dict<MangoAccount>> = {};

  private constructor(_chain: string, network: string) {
    this._chain = Solana.getInstance(network);
    this._client = MangoClient.connectDefault(this._chain.rpcUrl);
    this.derivativeApi = mangoDataApi;
    this.mangoGroup = MangoConfig.defaultGroup;
    this.conf = MangoConfig.config;
  }

  public static getInstance(chain: string, network: string): MangoClobPerp {
    if (MangoClobPerp._instances === undefined) {
      const config = getSolanaConfig(chain, network);
      MangoClobPerp._instances = new LRUCache<string, MangoClobPerp>({
        max: config.network.maxLRUCacheInstances,
      });
    }
    const instanceKey = chain + network;
    if (!MangoClobPerp._instances.has(instanceKey)) {
      MangoClobPerp._instances.set(
        instanceKey,
        new MangoClobPerp(chain, network)
      );
    }

    return MangoClobPerp._instances.get(instanceKey) as MangoClobPerp;
  }

  public async loadMarkets(group: Group) {
    // @note: Mango allows for groups that include a selection of markets in one cross-margin basket,
    //        but we are only supporting one group per Gateway instance for now. You can change the
    //        group in the config file (mango.defaultGroup)
    const derivativeMarkets = await this._client.perpGetMarkets(group);
    for (const market of derivativeMarkets) {
      const key = market.name;
      this.parsedMarkets[key] = market;
    }
  }

  public async init() {
    if (!this._chain.ready() || Object.keys(this.parsedMarkets).length === 0) {
      await this._chain.init();
      await this.loadMarkets(this.mangoGroup);
      this._ready = true;
    }
  }

  public ready(): boolean {
    return this._ready;
  }

  /**
   * Returns a context object for sending transactions with a stored wallet.
   */
  private async getProvider(address: string): Promise<AnchorProvider> {
    const wallet = new Wallet(await this._chain.getKeypair(address));
    return new AnchorProvider(this._chain.connection, wallet, {
      commitment: 'confirmed',
      maxRetries: 3,
      preflightCommitment: 'confirmed',
      skipPreflight: false,
    });
  }

  private getExistingMangoAccount(
    address: string,
    market: string
  ): MangoAccount | undefined {
    const userAccounts = this.mangoAccounts[address];
    return userAccounts === undefined ? undefined : userAccounts[market];
  }

  /**
   * Accepts a user's public key and a market name as used inside Mango (BTC-PERP, MNGO-PERP, ...)
   * This method makes sure that all existent accounts are being fetched, the first time a user is looking for his
   * MangoAccounts. Each combination of user address and market name have their own MangoAccount in order to realize
   * isolated margin-style positions.
   */
  private async getOrCreateMangoAccount(
    address: string,
    market: string
  ): Promise<MangoAccount> {
    let foundAccount = this.getExistingMangoAccount(address, market);
    if (foundAccount) return foundAccount;

    // check if user has been initialized and accounts fetched
    if (this.mangoAccounts[address] === undefined) {
      this.mangoAccounts[address] = {};
      const accounts = await this._client.getMangoAccountsForOwner(
        this.mangoGroup,
        new PublicKey(address)
      );
      accounts.forEach((account) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.mangoAccounts[address]![account.name] = account;
        if (account.name === market) foundAccount = account;
      });
      if (foundAccount) return foundAccount;
    }

    // get accounts and find accountNumber to use to create new MangoAccount
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accounts = Object.values(this.mangoAccounts[address]!).filter(
      (account) => {
        return account !== undefined;
      }
    ) as MangoAccount[];
    const usedIndexes = accounts.map((account) => account.accountNum).sort();
    const accountNumber = usedIndexes.find((value, index, array) => {
      if (index === array.length - 1) return true;
      return array[index - 1] + 1 !== value;
    });

    // @todo: Check if there is account space optimization possible with tokenCount
    const newAccount = await this._client.createAndFetchMangoAccount(
      this.mangoGroup,
      accountNumber,
      market,  // @todo: use asset symbol instead of market name?
      2
    );

    if (newAccount === undefined)
      // @note
      throw Error(
        `MangoAccount creation failure: ${market} - in group ${this.mangoGroup} for wallet ${address} (${accountNumber})\nDo you have enough SOL?`
      );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.mangoAccounts[address]![market] = newAccount;
    return newAccount;
  }

  public async markets(
    req: PerpClobMarketRequest
  ): Promise<{ markets: PerpClobMarkets<PerpMarket> }> {
    if (req.market && req.market.split('-').length === 2) {
      const resp: PerpClobMarkets = {};

      resp[req.market] = this.parsedMarkets[req.market];
      return { markets: resp };
    }
    return { markets: this.parsedMarkets };
  }

  public async orderBook(
    req: PerpClobOrderbookRequest
  ): Promise<Orderbook<BookSide>> {
    const resp = await this.markets(req);
    const market = resp.markets[req.market];
    const [buys, sells] = await Promise.all([
      market.loadBids(this._client),
      market.loadAsks(this._client),
    ]);
    return {
      buys,
      sells,
    };
  }

  private async loadFills(market: PerpMarket): Promise<PerpMarketFills> {
    return {
      marketName: market.name,
      fills: await market.loadFills(this._client),
    };
  }

  public async ticker(
    req: PerpClobTickerRequest
  ): Promise<{ markets: PerpClobMarkets }> {
    return await this.markets(req);
  }

  public async lastTradePrice(
    req: PerpClobGetLastTradePriceRequest
  ): Promise<string | null> {
    const resp = await this.markets(req);
    const market = resp.markets[req.market];
    const fills = await this.loadFills(market);
    if (fills.fills.length > 0) this._lastTradePrice = fills.fills[0].price;
    return this._lastTradePrice.toString();
  }

  public async trades(
    req: PerpClobGetTradesRequest
  ): Promise<Array<PerpTradeActivity>> {
    const mangoAccount = await this.getOrCreateMangoAccount(
      req.address,
      req.market
    );

    const trades = await this.derivativeApi.fetchPerpTradeHistory(
      mangoAccount.publicKey.toBase58()
    );

    let targetTrade = undefined;

    if (req.orderId !== undefined) {
      for (const trade of trades) {
        if (
          trade.taker_client_order_id === req.orderId ||
          trade.taker_order_id === req.orderId ||
          trade.maker_order_id === req.orderId
        ) {
          targetTrade = trade;
          break;
        }
      }
    }

    if (req.orderId !== undefined) {
      return targetTrade ? [targetTrade] : [];
    } else {
      return trades;
    }
  }

  public async orders(
    req: PerpClobGetOrderRequest
  ): Promise<Array<PerpTradeActivity>> {
    // @todo: currently returns the same as trades, is it a problem tho?
    const mangoAccount = await this.getOrCreateMangoAccount(
      req.address,
      req.market
    );
    const accountAddress = mangoAccount.publicKey.toBase58();
    let targetOrder = undefined;
    let orders = await this.derivativeApi.fetchPerpTradeHistory(accountAddress);

    if (req.limit) {
      if (req.limit > orders.length && orders.length === 10000) {
        // @note: paginate over multiple requests
        const allOrders = orders;
        let page = 1;
        while (orders.length === 10000 && allOrders.length < req.limit) {
          orders = await this.derivativeApi.fetchPerpTradeHistory(
            mangoAccount.publicKey.toBase58(),
            page
          );
          allOrders.push(...orders);
          page++;
        }
        orders = allOrders;
      }
      orders.slice(0, req.limit);
    }

    if (req.orderId !== undefined) {
      for (const order of orders) {
        if (
          order.taker_client_order_id === req.orderId ||
          order.taker_order_id === req.orderId ||
          order.maker_order_id === req.orderId
        ) {
          targetOrder = order;
          break;
        }
      }
    }

    if (req.orderId !== undefined) {
      return targetOrder ? [targetOrder] : [];
    } else {
      return orders;
    }
  }

  public static calculateMargin(
    price: string,
    quantity: string,
    leverage: number
  ): BN {
    // @todo: update with the asset/liability weight multipliers
    // margin = (price * quantity) / leverage
    const priceBig = new BN(price);
    const quantityBig = new BN(quantity);

    return priceBig.mul(quantityBig).divn(leverage);
  }

  public async postOrder(
    req: PerpClobPostOrderRequest
  ): Promise<{ txHash: string }> {
    return await this.orderUpdate(req);
  }

  public async deleteOrder(
    req: PerpClobDeleteOrderRequest
  ): Promise<{ txHash: string }> {
    return this.orderUpdate(req);
  }

  public async batchPerpOrders(
    req: PerpClobBatchUpdateRequest
  ): Promise<{ txHash: string }> {
    return this.orderUpdate(req);
  }

  public estimateGas(_req: NetworkSelectionRequest): {
    gasPrice: number;
    gasPriceToken: string;
    gasLimit: number;
    gasCost: number;
  } {
    return {
      gasPrice: this._chain.gasPrice,
      gasPriceToken: this._chain.nativeTokenSymbol,
      gasLimit: this.conf.gasLimitEstimate,
      gasCost: this._chain.gasPrice * this.conf.gasLimitEstimate,
    };
  }

  public async fundingInfo(): Promise<Array<OneHourFundingRate>> {
    return await this.derivativeApi.fetchOneHourFundingRate(
      this.mangoGroup.publicKey.toBase58()
    );
  }

  public async fundingPayments(
    req: PerpClobFundingPaymentsRequest
  ): Promise<Array<FundingPayment>> {
    const mangoAccount = await this.getOrCreateMangoAccount(
      req.address,
      req.market
    );
    const response = await this.derivativeApi.fetchFundingAccountHourly(
      mangoAccount.publicKey.toBase58()
    );
    const result: Record<string, Array<FundingPayment>> = {};
    Object.entries(response).forEach(([key, value]) => {
      result[key] = Object.entries(value).map(([key, value]) => {
        return {
          marketName: req.market,
          timestamp: Date.parse(key),
          amount: (value.long_funding + value.short_funding).toString(),
        };
      });
    });
    return result[req.market];
  }

  public async positions(
    req: PerpClobPositionRequest
  ): Promise<Array<PerpPosition>> {
    const marketIndexes = [];
    for (const market of req.markets) {
      marketIndexes.push(this.parsedMarkets[market].perpMarketIndex);
    }

    return await this.fetchPositions(marketIndexes, req.address);
  }

  private async fetchPositions(
    marketIndexs: PerpMarketIndex[],
    ownerPk: string
  ) {
    const positions: PerpPosition[] = [];

    marketIndexs.map((marketIndex) => {
      const mangoAccount = this.getExistingMangoAccount(
        ownerPk,
        marketIndex.toString()
      );

      if (mangoAccount === undefined) {
        return;
      }

      const filterdPerpPositions = mangoAccount
        .perpActive()
        .filter((pp) => pp.marketIndex === marketIndex);

      positions.concat(filterdPerpPositions);
    });

    return positions;
  }

  private async buildPostOrder(
    provider: AnchorProvider,
    orders: CreatePerpOrderParam[]
  ): Promise<TransactionInstruction[]> {
    const perpOrdersToCreate = [];
    for (const order of orders) {
      const mangoAccount = await this.getOrCreateMangoAccount(
        provider.wallet.publicKey.toBase58(),
        order.market
      );
      const market = this.parsedMarkets[order.market];
      perpOrdersToCreate.push(
        this._client.perpPlaceOrderV2Ix(
          this.mangoGroup,
          mangoAccount,
          market.perpMarketIndex,
          translateOrderSide(order.side),
          Number(order.price),
          Number(order.amount),
          undefined,
          order.clientOrderID,
          translateOrderType(order.orderType)
        )
      );
    }
    return await Promise.all(perpOrdersToCreate);
  }

  private async buildDeleteOrder(
    provider: AnchorProvider,
    orders: ClobDeleteOrderRequestExtract[]
  ): Promise<TransactionInstruction[]> {
    const perpOrdersToCancel = [];
    for (const order of orders) {
      const mangoAccount = await this.getOrCreateMangoAccount(
        provider.wallet.publicKey.toBase58(),
        order.market
      );
      const market = this.parsedMarkets[order.market];
      perpOrdersToCancel.push(
        this._client.perpCancelOrderIx(
          this.mangoGroup,
          mangoAccount,
          market.perpMarketIndex,
          new BN(order.orderId)
        )
      );
    }
    return await Promise.all(perpOrdersToCancel);
  }

  public async orderUpdate(
    req:
      | PerpClobDeleteOrderRequest
      | PerpClobPostOrderRequest
      | PerpClobBatchUpdateRequest
  ): Promise<{ txHash: string }> {
    // TODO: Find out how much Compute Units each instruction type uses and batch them in one or multiple transactions
    // TODO: Transfer funds to MangoAccount if necessary
    const walletProvider = await this.getProvider(req.address);
    const { perpOrdersToCreate, perpOrdersToCancel } =
      extractPerpOrderParams(req);

    const instructions = [
      ...(await this.buildDeleteOrder(walletProvider, perpOrdersToCancel)),
      ...(await this.buildPostOrder(walletProvider, perpOrdersToCreate)),
    ];

    const txHash = await this._client.sendAndConfirmTransaction(instructions, {
      alts: this.mangoGroup.addressLookupTablesList,
    });
    return { txHash };
  }
}
