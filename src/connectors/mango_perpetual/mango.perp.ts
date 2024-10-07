import BN from 'bn.js';
import LRUCache from 'lru-cache';
import { Solana } from '../../chains/solana/solana';
import { getSolanaConfig } from '../../chains/solana/solana.config';
import {
  ClobDeleteOrderRequestExtract,
  CreatePerpOrderParam,
  extractPerpOrderParams,
  FundingInfo,
  Orderbook,
  PerpClobBatchUpdateRequest,
  PerpClobDeleteOrderRequest,
  PerpClobFundingInfoRequest,
  PerpClobFundingPaymentsRequest,
  PerpClobGetLastTradePriceRequest,
  PerpClobGetOrderRequest,
  PerpClobGetTradesRequest,
  PerpClobMarketRequest,
  PerpClobMarkets,
  PerpClobOrderbookRequest,
  PerpClobPositionRequest,
  PerpClobPostOrderRequest,
  PerpClobTickerRequest,
} from '../../clob/clob.requests';
import {
  NetworkSelectionRequest,
  PriceLevel,
} from '../../services/common-interfaces';
import { MangoConfig } from './mango.config';
import {
  Group,
  HealthType,
  I80F48,
  MANGO_V4_ID,
  MangoAccount,
  MangoClient,
  PerpMarket,
  PerpMarketIndex,
  PerpOrder,
  PerpPosition,
} from '@blockworks-foundation/mango-v4';
import {
  FundingPayment,
  Market,
  PerpTradeActivity,
  Position,
} from './mango.types';
import {
  randomInt,
  translateOrderSide,
  translateOrderType,
  OrderTracker,
  OrderStatus,
  OrderTrackingInfo,
  FillsFeed,
  FillEventUpdate,
} from './mango.utils';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import { mangoDataApi, MangoDataApi } from './mango.api';
import Dict = NodeJS.Dict;
import { BalanceRequest } from '../../network/network.requests';
import Decimal from 'decimal.js-light';

type OrderIdentifier = {
  clientOrderId: number;
  expiryTimestamp: string;
};

type IdentifiedOrder = {
  clientOrderId: string;
  exchangeOrderId: string;
};

type IdentifiablePostOrdersIxs = {
  instructions: TransactionInstruction[];
  identifiers: OrderIdentifier[];
};

const RECONNECT_INTERVAL_MS = 500;
const RECONNECT_ATTEMPTS_MAX = 10;
const WS_API_URL = 'wss://api.mngo.cloud/fills/v1/';

export class MangoClobPerp {
  private static _instances: LRUCache<string, MangoClobPerp>;
  private readonly _chain: Solana;
  private readonly _client: MangoClient;
  private readonly _orderTracker: OrderTracker;
  public derivativeApi: MangoDataApi;
  public mangoGroupPublicKey: PublicKey;
  public mangoGroup: Group;
  public conf: MangoConfig.NetworkConfig;

  private _ready: boolean = false;
  private _tempClient: MangoClient | undefined; // TODO: manage temp client by wallet address -> make it into array of addresses MangoClient[]
  private _fillsFeeds = new Map<string, Map<string, FillsFeed>>(); // 1st key: mango market address, 2nd key: mango account address, value: fill feed

  public parsedMarkets: PerpClobMarkets<PerpMarket> = {};
  // @note: Contains all MangoAccounts, grouped by owner address and base asset
  public mangoAccounts: Dict<Dict<MangoAccount>> = {};

  private constructor(_chain: string, network: string) {
    this._chain = Solana.getInstance(network);
    this._client = this.connectMangoClient(new Keypair());
    this._orderTracker = new OrderTracker();
    this.derivativeApi = mangoDataApi;
    this.mangoGroupPublicKey = new PublicKey(MangoConfig.defaultGroup);
    this.mangoGroup = {} as Group;
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
        new MangoClobPerp(chain, network),
      );
    }

    return MangoClobPerp._instances.get(instanceKey) as MangoClobPerp;
  }

  public async loadMarkets(group: Group) {
    // @note: Mango allows for groups that include a selection of markets in one cross-margin basket,
    //        but we are only supporting one group per Gateway instance for now. You can change the
    //        group in the config file (mango.defaultGroup)
    await group.reloadAll(this._client);
    const derivativeMarkets = await this._client.perpGetMarkets(group);
    for (const market of derivativeMarkets) {
      const key = market.name;
      this.parsedMarkets[key] = market;
    }
  }

  public async init() {
    if (!this._chain.ready() || Object.keys(this.parsedMarkets).length === 0) {
      await this._chain.init();
      this.mangoGroup = await this._client.getGroup(this.mangoGroupPublicKey);
      await this.loadMarkets(this.mangoGroup);
      this._ready = true;
    }
  }

  public ready(): boolean {
    return this._ready;
  }

  /**
   * Returns a MangoClient instance that is connected to the Solana network
   * @note: This is an alternative way to connect to the MangoClient, because the connectDefaults will
   *       spam requests to the Solana cluster causing rate limit errors.
   */
  private connectMangoClient(
    keypair: Keypair,
    isAPI: boolean = true,
  ): MangoClient {
    const clientKeypair = keypair;
    const options = AnchorProvider.defaultOptions();
    const connection = new Connection(this._chain.rpcUrl, options);

    const clientWallet = new Wallet(clientKeypair);
    const clientProvider = new AnchorProvider(connection, clientWallet, {
      ...options,
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    const idsSource = isAPI ? 'api' : 'get-program-accounts';

    return MangoClient.connect(
      clientProvider,
      'mainnet-beta',
      MANGO_V4_ID['mainnet-beta'],
      {
        idsSource,
      },
    );
  }

  /**
   * Returns a context object for sending transactions with a stored wallet.
   */
  private async getProvider(address: string): Promise<AnchorProvider> {
    const wallet = new Wallet(await this._chain.getKeypair(address));
    const options = AnchorProvider.defaultOptions();

    return new AnchorProvider(this._chain.connection, wallet, options);
  }

  private getExistingMangoAccount(
    address: string,
    market: string,
  ): MangoAccount | undefined {
    const userAccounts = this.mangoAccounts[address];
    return userAccounts === undefined ? undefined : userAccounts[market];
  }

  /**
   * Retrieves a MangoAccount for a given user's public key and market name.
   * If the account is not already fetched, it will attempt to fetch all existing accounts for the user.
   * Each user address has its own MangoAccount named "robotter".
   * Once the account is found, it subscribes to the fills feed for real-time updates.
   */
  public async getMangoAccount(
    address: string,
    market?: string,
  ): Promise<MangoAccount> {
    const defaultAccount = 'robotter';
    let foundAccount = this.getExistingMangoAccount(address, defaultAccount);

    // check if user has been initialized and accounts fetched
    if (!foundAccount && this.mangoAccounts[address] === undefined) {
      foundAccount = await this.fetchExistingAccounts(address, defaultAccount);
    }

    if (foundAccount) {
      // Begin listening to fills feed only if market is not undefined
      if (market) {
        this.subscribeToFillsFeed(
          foundAccount,
          this.parsedMarkets[market].publicKey.toString(),
        );
      }

      return foundAccount;
    } else {
      throw new Error('Mango account not found');
    }
  }

  private async fetchExistingAccounts(
    address: string,
    market: string | undefined,
  ) {
    let foundAccount: MangoAccount | undefined;
    const accounts = await this._client.getMangoAccountsForOwner(
      this.mangoGroup,
      new PublicKey(address),
    );
    this.mangoAccounts[address] = {};
    accounts.forEach((account) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.mangoAccounts[address]![account.name] = account;
      if (market && account.name === market) foundAccount = account;
    });

    return foundAccount;
  }

  private subscribeToFillsFeed(
    mangoAccount: MangoAccount,
    marketAddress: string,
  ) {
    // Check if fills feed already exists
    if (this._fillsFeeds.has(marketAddress)) {
      if (
        this._fillsFeeds
          .get(marketAddress)
          ?.has(mangoAccount.publicKey.toString())
      ) {
        return;
      }
    }

    // Create new fills feed
    const fillsFeed = new FillsFeed(WS_API_URL, {
      reconnectionIntervalMs: RECONNECT_INTERVAL_MS,
      reconnectionMaxAttempts: RECONNECT_ATTEMPTS_MAX,
      subscriptions: {
        account: [mangoAccount.publicKey.toString()],
      },
    });

    // Subscribe after connection
    fillsFeed.onConnect(() => {
      console.log(`${mangoAccount.name}'s fill feed connected`);
      fillsFeed.subscribe({
        marketIds: [marketAddress],
        headUpdates: true,
      });
    });

    fillsFeed.onDisconnect(() => {
      console.log(
        `${mangoAccount.name}'s fill feed is disconnected, reconnecting in ${RECONNECT_INTERVAL_MS}...`,
      );
    });

    fillsFeed.onFill((update) => {
      console.log(
        `🪧 -> file: mango.perp.ts:398 -> MangoClobPerp -> fillsFeed.onFill -> ${mangoAccount.name}'s fill update:`,
        update,
      );
      this.processFillEvent(update);
    });

    // Assign to fillsFeeds
    if (!this._fillsFeeds.has(marketAddress)) {
      this._fillsFeeds.set(marketAddress, new Map());
    }

    this._fillsFeeds
      .get(marketAddress)
      ?.set(mangoAccount.publicKey.toString(), fillsFeed);
  }

  private processFillEvent(fill: FillEventUpdate) {
    // Fill event update content:
    //   {
    //     "event": {
    //         "eventType": "perp",
    //         "maker": "4hXPGTmR6dKNNqjLYdfDRSrTaa1Wt2GZoZnQ9hAJEeev",
    //         "taker": "BLgb4NFwhpurMrGX5LQfb8D8dBpGSGtBqqew2Em8uyRT",
    //         "takerSide": "bid",
    //         "timestamp": "2023-11-23T06:58:17+00:00",
    //         "seqNum": 2109999,
    //         "makerClientOrderId": 1700722495,
    //         "takerClientOrderId": 1700722696624431,
    //         "makerFee": -0.0003,
    //         "takerFee": 0.0006,
    //         "price": 58.15,
    //         "quantity": 8.48
    //     },
    //     "marketKey": "ESdnpnNLgTkBCZRuTJkZLi5wKEZ2z47SG3PJrhundSQ2",
    //     "marketName": "SOL-PERP",
    //     "status": "new",
    //     "slot": 231710720,
    //     "writeVersion": 944125025548
    // }
    const makerClientOrderId = fill.event.makerClientOrderId;
    const takerClientOrderId = fill.event.takerClientOrderId;
    const fillAmount = fill.event.quantity;
    const fillPrice = fill.event.price;
    const makerFee = fill.event.makerFee;
    const takerFee = fill.event.takerFee;
    const timestamp = Date.parse(fill.event.timestamp);
    const slot = fill.slot;
    const seqNum = fill.event.seqNum;

    let isMaker: boolean;
    let trackingInfo: OrderTrackingInfo | undefined;

    // Get tracking info using client order id
    if (
      (trackingInfo = this._orderTracker.getOrderTrackingInfo(
        makerClientOrderId.toString(),
      ))
    ) {
      isMaker = true;
    } else if (
      (trackingInfo = this._orderTracker.getOrderTrackingInfo(
        takerClientOrderId.toString(),
      ))
    ) {
      isMaker = false;
    } else {
      return;
    }

    // Update tracking info
    const fillEntry = {
      id: `${slot}-${seqNum}`,
      price: fillPrice,
      quantity: fillAmount,
      fee: isMaker ? makerFee : takerFee,
      timestamp: timestamp,
    };

    // Sum up fill amounts in currentFills
    const currentFillAmount = trackingInfo.fills.reduce(
      (acc, fill) => acc + fill.quantity,
      0,
    );

    // Check if current fill amount + new fill amount is greater than order amount
    if (currentFillAmount + fillAmount >= trackingInfo.orderAmount) {
      this._orderTracker.updateOrderStatus(
        trackingInfo.clientOrderId,
        OrderStatus.FILLED,
        fillEntry,
      );
    } else {
      this._orderTracker.updateOrderStatus(
        trackingInfo.clientOrderId,
        OrderStatus.PARTIALLY_FILLED,
        fillEntry,
      );
    }
  }

  public async markets(
    req: PerpClobMarketRequest,
  ): Promise<{ markets: PerpClobMarkets<Market> }> {
    if (req.market && req.market.split('-').length === 2) {
      const resp: PerpClobMarkets<Market> = {};
      const market = this.parsedMarkets[req.market];

      resp[req.market] = {
        name: market.name,
        miniumOrderSize: market.minOrderSize,
        tickSize: market.tickSize,
        minQuoteAmountIncrement: market.quoteLotsToUi(new BN(1)),
        minBaseAmountIncrement: market.baseLotsToUi(new BN(1)),
        takerFee: market.takerFee.toNumber(),
        makerFee: market.makerFee.toNumber(),
      };

      return { markets: resp };
    }

    const mappedMarkets = Object.keys(this.parsedMarkets).reduce(
      (acc, marketName) => {
        const market = this.parsedMarkets[marketName];
        acc[marketName] = {
          name: market.name,
          miniumOrderSize: market.minOrderSize,
          tickSize: market.tickSize,
          minQuoteAmountIncrement: market.quoteLotsToUi(new BN(1)),
          minBaseAmountIncrement: market.baseLotsToUi(new BN(1)),
          takerFee: market.takerFee.toNumber(),
          makerFee: market.makerFee.toNumber(),
        };
        return acc;
      },
      {} as PerpClobMarkets<Market>,
    );

    return { markets: mappedMarkets };
  }

  public async orderBook(
    req: PerpClobOrderbookRequest,
  ): Promise<Orderbook<any>> {
    const market = this.parsedMarkets[req.market];

    // @note: use getL2Ui to get the correct price levels
    const bids = (await market.loadBids(this._client, true)).getL2Ui(10);
    const asks = (await market.loadAsks(this._client, true)).getL2Ui(10);

    // @note: currently all timestamp are the same
    const currentTime = Date.now();
    const buys: PriceLevel[] = [];
    const sells: PriceLevel[] = [];

    bids.forEach((bid) => {
      buys.push({
        price: bid[0].toString(),
        quantity: bid[1].toString(),
        timestamp: currentTime,
      });
    });

    asks.forEach((ask) => {
      sells.push({
        price: ask[0].toString(),
        quantity: ask[1].toString(),
        timestamp: currentTime,
      });
    });

    return {
      buys,
      sells,
    };
  }

  public async ticker(
    req: PerpClobTickerRequest,
  ): Promise<{ markets: PerpClobMarkets<Market> }> {
    return await this.markets(req);
  }

  public async lastTradePrice(
    req: PerpClobGetLastTradePriceRequest,
  ): Promise<string | null> {
    // TODO: fills return empty, get stable price as temp fix
    await this.mangoGroup.reloadPerpMarkets(this._client);
    const market = this.parsedMarkets[req.market];
    const bank = this.mangoGroup.getFirstBankByTokenIndex(
      market.settleTokenIndex,
    );
    const base = market.name.split('-')[0];
    const decimals = <string>bank.mintDecimals.toString();
    const stableDecimals = base === 'SOL' ? 3 : 6;

    const stablePrice = I80F48.fromString(
      market.stablePriceModel.stablePrice.toString(),
    );

    return stablePrice
      .mul(I80F48.fromString(`1e${decimals}`))
      .div(I80F48.fromString(`1e${stableDecimals}`))
      .toString();
  }

  // TODO: rework this to get trades from fill feeds
  public async trades(
    req: PerpClobGetTradesRequest,
  ): Promise<Array<PerpTradeActivity>> {
    const mangoAccount = await this.getMangoAccount(req.address, req.market);

    const trades = await this.derivativeApi.fetchPerpTradeHistory(
      mangoAccount.publicKey.toBase58(),
      100,
    );

    let targetTrade = undefined;

    if (req.orderId !== undefined) {
      for (const trade of trades) {
        if (
          trade.taker_client_order_id === req.orderId ||
          trade.maker_client_order_id === req.orderId
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

  // TODO: Add test
  public async balances(req: BalanceRequest): Promise<Record<string, string>> {
    if (req.tokenSymbols.find((symbol) => symbol === 'PERP')) {
      req.tokenSymbols.push('USDC');
      req.tokenSymbols.splice(req.tokenSymbols.indexOf('PERP'), 1);
    }

    let mangoAccounts = this.mangoAccounts[req.address];

    if (mangoAccounts === undefined) {
      await this.fetchExistingAccounts(req.address, undefined);
      mangoAccounts = this.mangoAccounts[req.address];
    }

    if (mangoAccounts === undefined) {
      return {};
    }

    const balancesMap: Map<string, string> = new Map<string, string>();
    for (const [, account] of Object.entries(mangoAccounts)) {
      if (account === undefined) continue;
      for (const token of account.tokensActive()) {
        const bank = this.mangoGroup.getFirstBankByTokenIndex(token.tokenIndex);
        const amount = token
          .balance(bank)
          .div(I80F48.fromString(`1e${bank.mintDecimals}`));
        const symbol = bank.name;
        if (balancesMap.get(symbol) === undefined) {
          balancesMap.set(symbol, amount.toString());
        } else {
          const newAmount = new Decimal(balancesMap.get(symbol)!).add(
            new Decimal(amount.toString()),
          );
          balancesMap.set(symbol, newAmount.toString());
        }
      }
    }

    const balances: Record<string, string> = {};
    for (const [key, value] of balancesMap.entries()) {
      balances[key] = value;
    }
    console.log('🪧 -> MangoClobPerp -> balances -> balances:', balances);

    return balances;
  }

  public async orders(
    req: PerpClobGetOrderRequest,
  ): Promise<Array<OrderTrackingInfo>> {
    const mangoAccount = await this.getMangoAccount(req.address, req.market);

    await mangoAccount.reload(this._client);

    const orders = await mangoAccount.loadPerpOpenOrdersForMarket(
      this._client,
      this.mangoGroup,
      this.parsedMarkets[req.market].perpMarketIndex,
      true,
    );

    for (const order of orders) {
      this.processOrderUpdate(order);
    }

    this.processTargetedOrderUpdate(orders, req.orderId, req.clientOrderId);

    const mappedTrackingInfo = this._orderTracker
      .getAllOrderTrackingInfo()
      .map((info) => {
        return {
          clientOrderId:
            info.clientOrderId === req.clientOrderId
              ? `${info.clientOrderId} <- Requested`
              : info.clientOrderId,
          exchangeOrderId: info.exchangeOrderId,
          status: info.status,
          side: info.side,
        };
      })
      .filter((info) => {
        return info.status !== OrderStatus.CANCELLED;
      });
    console.log(
      '🪧 -> file: mango.perp.ts:746 -> MangoClobPerp -> processOrderUpdate:',
      mappedTrackingInfo,
    );

    // TODO: dummyOrder is a hack to return the order info if it is not tracked
    const dummyOrder: OrderTrackingInfo = {
      clientOrderId: '',
      status: OrderStatus.CANCELLED,
      price: 0,
      orderAmount: 0,
      fills: [],
      side: 'BUY',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (req.orderId !== undefined) {
      const targetOrder =
        this._orderTracker.getOrderTrackingInfoByExchangeOrderId(req.orderId);

      if (targetOrder === undefined) {
        dummyOrder.clientOrderId = req.clientOrderId ?? '';
        dummyOrder.exchangeOrderId = req.orderId;
        return [dummyOrder];
      } else {
        return [targetOrder];
      }

      // return targetOrder ? [targetOrder] : [];
    } else if (req.clientOrderId !== undefined) {
      const targetOrder = this._orderTracker.getOrderTrackingInfo(
        req.clientOrderId,
      );

      if (targetOrder === undefined) {
        dummyOrder.clientOrderId = req.clientOrderId;
        dummyOrder.exchangeOrderId = req.orderId;
        return [dummyOrder];
      } else {
        return [targetOrder];
      }

      // return targetOrder ? [targetOrder] : [];
    } else {
      return this._orderTracker.getAllOrderTrackingInfo();
    }
  }

  private processTargetedOrderUpdate(
    orders: PerpOrder[],
    exchangeOrderId: string | undefined,
    clientOrderId: string | undefined,
  ) {
    let targetOrder = undefined;

    if (exchangeOrderId !== undefined && exchangeOrderId.length > 0) {
      targetOrder =
        this._orderTracker.getOrderTrackingInfoByExchangeOrderId(
          exchangeOrderId,
        );
    } else if (clientOrderId !== undefined) {
      targetOrder = this._orderTracker.getOrderTrackingInfo(clientOrderId);
    }

    if (targetOrder === undefined) {
      // TODO: Order is not tracked for some reason, put some error here to investigate
      throw Error(
        `Order with exchangeOrderId: ${exchangeOrderId} and clientOrderId ${clientOrderId} is not tracked`,
      );
    }

    for (const order of orders) {
      if (order.orderId.toString() === exchangeOrderId) {
        // Found the order, meaning it is still open
        return;
      }
    }

    // Order is not found, meaning it is closed
    // Unless order is already CANCELLED, FILLED or EXPIRED, update the status
    if (targetOrder.status === OrderStatus.PENDING_CANCEL) {
      if (exchangeOrderId !== undefined) {
        this._orderTracker.updateOrderStatusByExchangeOrderId(
          exchangeOrderId,
          OrderStatus.CANCELLED,
        );
      } else if (clientOrderId !== undefined) {
        this._orderTracker.updateOrderStatus(
          clientOrderId,
          OrderStatus.CANCELLED,
        );
      }
    }
  }

  private processOrderUpdate(order: PerpOrder) {
    const trackingInfo =
      this._orderTracker.getOrderTrackingInfoByExchangeOrderId(
        order.orderId.toString(),
      );

    if (trackingInfo !== undefined) {
      if (trackingInfo.status === OrderStatus.PENDING_CANCEL) return;

      if (order.isExpired) {
        this._orderTracker.updateOrderStatusByExchangeOrderId(
          order.orderId.toString(),
          OrderStatus.EXPIRED,
        );

        return;
      }
    } else {
      return;
    }
  }

  public static calculateMargin(
    price: string,
    quantity: string,
    leverage: number,
  ): I80F48 {
    /**
     * Returns the margin required for a PerpOrder in USDC
     */
    const priceBig = I80F48.fromString(price);
    const quantityBig = I80F48.fromString(quantity);
    const leverageBig = I80F48.fromString(leverage.toString());

    return priceBig.mul(quantityBig).div(leverageBig);
  }

  public getFreeCollateral(mangoAccount: MangoAccount) {
    /**
     * Returns the free collateral of a MangoAccount in USDC
     */
    const decimals = <string>(
      this.mangoGroup.banksMapByName.get('USDC')?.[0].mintDecimals.toString()
    );
    const decimalsBig = I80F48.fromString('1e' + decimals);
    return mangoAccount
      .getHealth(this.mangoGroup, HealthType.init)
      .div(decimalsBig);
  }

  private mapClientOrderIDs(result: {
    txHash: string;
    identifiedOrders: IdentifiedOrder[] | undefined;
  }) {
    // TODO: should return { txHash, [{clientId1, exchangeId1}, {clientId2, exchangeId2}] } instead
    return {
      txHash: result.txHash,
      exchangeOrderId:
        result.identifiedOrders?.map(
          (identifiedOrder) => identifiedOrder.exchangeOrderId,
        ) ?? [],
    };
  }

  private async checkIfOrderAreFilled(
    address: string,
    market: string,
    clientOrderId: string,
  ) {
    // Wait for 500ms to make sure order is processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mangoAccount = await this.getMangoAccount(address, market);
    const trades = await this.derivativeApi.fetchPerpTradeHistory(
      mangoAccount.publicKey.toBase58(),
      20,
    );

    if (trades === undefined) {
      return;
    }

    if (trades.filter === undefined) {
      return;
    }

    const foundTrades = trades.filter(
      (trade) =>
        trade.maker_client_order_id === clientOrderId ||
        trade.taker_client_order_id === clientOrderId,
    );
    console.log(
      '🪧 -> file: mango.perp.ts:919 -> MangoClobPerp -> foundTrades:',
      foundTrades,
    );

    for (const trade of foundTrades) {
      const fillEntry = {
        id: `${trade.slot}-${trade.seq_num}`,
        price: trade.price,
        quantity: trade.quantity,
        fee:
          trade.maker_client_order_id === clientOrderId
            ? trade.maker_fee
            : trade.taker_fee,
        timestamp: Date.parse(trade.block_datetime),
      };

      this._orderTracker.updateOrderStatus(
        clientOrderId,
        OrderStatus.PARTIALLY_FILLED,
        fillEntry,
      );
    }

    const trackingInfo = this._orderTracker.getOrderTrackingInfo(clientOrderId);

    if (trackingInfo !== undefined) {
      // Sum up fill amounts in currentFills
      const currentFillAmount = trackingInfo.fills.reduce(
        (acc, fill) => acc + fill.quantity,
        0,
      );

      // Check if current fill amount is equal or greater than order amount
      if (currentFillAmount >= trackingInfo.orderAmount) {
        this._orderTracker.updateOrderStatus(
          trackingInfo.clientOrderId,
          OrderStatus.FILLED,
        );
      } else if (currentFillAmount > 0) {
        this._orderTracker.updateOrderStatus(
          trackingInfo.clientOrderId,
          OrderStatus.PARTIALLY_FILLED,
        );
      }
    } else {
      throw Error(
        `checkIfOrderAreFilled: Order client id: ${trackingInfo} not found`,
      );
    }
  }

  public async postOrder(req: PerpClobPostOrderRequest): Promise<{
    txHash: string;
    clientOrderId?: string | string[];
  }> {
    if (req.clientOrderId !== undefined) {
      const currentTimestamp = Date.now();
      this._orderTracker.addOrder(
        req.clientOrderId,
        Number(req.price),
        Number(req.amount),
        req.side,
        currentTimestamp,
        currentTimestamp,
      );
    } else {
      throw Error('Client order ID is required');
    }

    const result = await this.orderUpdate(req);
    await this.checkIfOrderAreFilled(
      req.address,
      req.market,
      req.clientOrderId,
    );

    return this.mapClientOrderIDs(result);
  }

  public async deleteOrder(req: PerpClobDeleteOrderRequest): Promise<{
    txHash: string;
    clientOrderId?: string | string[];
  }> {
    let order = this._orderTracker.getOrderTrackingInfoByExchangeOrderId(
      req.orderId,
    );

    if (order === undefined) {
      throw Error('deleteOrder: Order not found');
    }

    await this.checkIfOrderAreFilled(
      req.address,
      req.market,
      order.clientOrderId,
    );

    order = this._orderTracker.getOrderTrackingInfoByExchangeOrderId(
      req.orderId,
    );

    if (
      order!.status === OrderStatus.OPEN ||
      order!.status === OrderStatus.PARTIALLY_FILLED
    ) {
      this._orderTracker.updateOrderStatusByExchangeOrderId(
        req.orderId,
        OrderStatus.PENDING_CANCEL,
      );
      const result = await this.orderUpdate(req);
      return this.mapClientOrderIDs(result);
    } else {
      const result = {
        txHash: '',
        exchangeOrderId: [req.orderId],
      };

      return result;
    }
  }

  public async batchPerpOrders(req: PerpClobBatchUpdateRequest): Promise<{
    txHash: string;
    clientOrderId?: string | string[];
  }> {
    const result = await this.orderUpdate(req);
    return this.mapClientOrderIDs(result);
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

  public async fundingInfo(
    req: PerpClobFundingInfoRequest,
  ): Promise<FundingInfo> {
    await this.mangoGroup.reloadPerpMarkets(this._client);
    await this.mangoGroup.reloadPerpMarketOraclePrices(this._client);
    const oraclePerpMarket = this.mangoGroup.getPerpMarketByName(req.market);
    const marketId = req.market;
    const indexPrice = oraclePerpMarket.price.toString();
    const markPrice = oraclePerpMarket.stablePriceModel.stablePrice.toString();

    // Get daily instantaneous funding rate
    const fr = oraclePerpMarket.getInstantaneousFundingRateUi(
      await oraclePerpMarket.loadBids(this._client),
      await oraclePerpMarket.loadAsks(this._client),
    );

    // @note: Funding is continuously applied on every interaction to a perp position.
    //        We should handle this differently from deterministic funding rate (e.g. every 8 hours)
    //        For now, let make it like a periodic thing (every 1 hour), and we can change it later
    const nextFundingTimestamp = Date.now() + 60 * 60 * 1000;

    return {
      marketId,
      indexPrice,
      markPrice,
      fundingRate: (fr / 24).toString(),
      nextFundingTimestamp: nextFundingTimestamp * 1e3,
    };
  }

  public async fundingPayments(
    req: PerpClobFundingPaymentsRequest,
  ): Promise<Array<FundingPayment>> {
    const mangoAccount = await this.getMangoAccount(req.address, req.market);

    // @note: take too long to fetch all funding payments
    const response = await this.derivativeApi.fetchFundingAccountHourly(
      mangoAccount.publicKey.toBase58(),
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

    if (result[req.market] !== undefined) {
      // Filter out empty amounts
      result[req.market] = result[req.market].filter(
        (payment) => payment.amount !== '0',
      );
    } else {
      result[req.market] = [];
    }

    return result[req.market];
  }

  public async positions(
    req: PerpClobPositionRequest,
  ): Promise<Array<Position>> {
    const marketIndexes = [];
    for (const market of req.markets) {
      marketIndexes.push(this.parsedMarkets[market].perpMarketIndex);
    }

    const returnPositions = await this.fetchPositions(
      marketIndexes,
      req.address,
    );
    console.log(
      '🪧 -> file: mango.perp.ts:877 -> MangoClobPerp -> returnPositions:',
      returnPositions,
    );

    return returnPositions;
  }

  private async fetchPositions(
    marketIndexes: PerpMarketIndex[],
    ownerPk: string,
  ) {
    let positions: PerpPosition[] = [];
    let marketIndexesToQuery = marketIndexes;
    // await this.mangoGroup.reloadPerpMarkets(this._client);
    await this.loadMarkets(this.mangoGroup);

    if (marketIndexes.length === 0) {
      marketIndexesToQuery = Object.values(this.parsedMarkets).map(
        (market) => market.perpMarketIndex,
      );
    }

    for (const marketIndex of marketIndexesToQuery) {
      const market = Object.values(this.parsedMarkets).find(
        (market) => market.perpMarketIndex === marketIndex,
      );

      if (market === undefined) {
        continue;
      }

      const mangoAccount = await this.fetchExistingAccounts(
        ownerPk,
        market.name,
      );

      if (mangoAccount === undefined) {
        continue;
      }

      await mangoAccount.reload(this._client);

      const filteredPerpPositions = mangoAccount
        .perpActive()
        .filter((pp) => pp.marketIndex === marketIndex);

      positions = positions.concat(filteredPerpPositions);
    }

    const mappedPositions: Position[] = [];

    positions.forEach((position) => {
      if (position.basePositionLots.eq(new BN(0))) return;

      const side = position.basePositionLots.gt(new BN(0)) ? 'LONG' : 'SHORT';
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const market = Object.values(this.parsedMarkets).find(
        (market) => market.perpMarketIndex === position.marketIndex,
      )!;

      const entryPrice = position.getAverageEntryPriceUi(market);
      // TODO: pretty hacky way to get sol stable price
      const currentPrice =
        market.name === 'SOL-PERP'
          ? market.stablePriceModel.stablePrice * 1000
          : market.stablePriceModel.stablePrice;
      const priceChange = currentPrice - entryPrice;

      const unrealizedPnl =
        market.baseLotsToUi(position.basePositionLots) * priceChange;

      mappedPositions.push({
        market: market.name,
        side,
        unrealizedPnl: unrealizedPnl.toString(),
        averageEntryPrice: entryPrice.toString(),
        amount: market.baseLotsToUi(position.basePositionLots).toString(),
        leverage: '1', // TODO: calculate leverage
      });
    });

    return mappedPositions;
  }

  private async buildIdentifiablePostOrder(
    client: MangoClient,
    provider: AnchorProvider,
    orders: CreatePerpOrderParam[],
  ): Promise<IdentifiablePostOrdersIxs> {
    const perpOrdersToCreate = [];
    const identifiers: OrderIdentifier[] = [];
    const missingCollateral = new Map<string, I80F48>();
    for (const order of orders) {
      const mangoAccount = await this.getMangoAccount(
        provider.wallet.publicKey.toBase58(),
        order.market,
      );
      const market = this.parsedMarkets[order.market];
      const identifier = Math.floor(Date.now() / 1000) + randomInt(3600, 7200);
      const freeCollateral = this.getFreeCollateral(mangoAccount);
      const requiredMargin = MangoClobPerp.calculateMargin(
        order.price,
        order.amount,
        order.leverage,
      );
      if (freeCollateral.lt(requiredMargin)) {
        if (missingCollateral.get(order.market) === undefined) {
          missingCollateral.set(
            order.market,
            requiredMargin.sub(freeCollateral),
          );
        } else {
          missingCollateral.set(
            order.market,
            <I80F48>missingCollateral.get(order.market)?.add(requiredMargin),
          );
        }
      }
      perpOrdersToCreate.push(
        client.perpPlaceOrderV2Ix(
          this.mangoGroup,
          mangoAccount,
          market.perpMarketIndex,
          translateOrderSide(order.side),
          Number(order.price),
          Number(order.amount),
          undefined,
          Number(order.clientOrderId),
          translateOrderType(order.orderType),
          undefined,
          undefined,
          identifier,
        ),
      );
      identifiers.push({
        clientOrderId: Number(order.clientOrderId),
        expiryTimestamp: identifier.toString(),
      });
    }

    for (const [market, amount] of missingCollateral.entries()) {
      const mangoAccount = await this.getMangoAccount(
        provider.wallet.publicKey.toBase58(),
        market,
      );
      try {
        const signature = await client.tokenDeposit(
          this.mangoGroup,
          mangoAccount,
          this.mangoGroup.banksMapByName.get('USDC')?.[0].mint as PublicKey,
          amount.toNumber(),
        );
        console.info('Depositing tokens, signature: ', signature);
        if (signature.err) {
          throw Error(
            `Failed to deposit USDC for margin: ${signature.err.toString()}`,
          );
        }
      } catch (error) {
        throw Error(`Failed to deposit USDC collateral: ${error}`);
      }
    }

    return {
      instructions: await Promise.all(perpOrdersToCreate),
      identifiers,
    };
  }

  private async buildDeleteOrder(
    client: MangoClient,
    provider: AnchorProvider,
    orders: ClobDeleteOrderRequestExtract[],
  ): Promise<TransactionInstruction[]> {
    const perpOrdersToCancel = [];
    for (const order of orders) {
      const mangoAccount = await this.getMangoAccount(
        provider.wallet.publicKey.toBase58(),
        order.market,
      );
      const market = this.parsedMarkets[order.market];
      perpOrdersToCancel.push(
        client.perpCancelOrderIx(
          this.mangoGroup,
          mangoAccount,
          market.perpMarketIndex,
          new BN(order.orderId),
        ),
      );
    }
    return await Promise.all(perpOrdersToCancel);
  }

  public async orderUpdate(
    req:
      | PerpClobDeleteOrderRequest
      | PerpClobPostOrderRequest
      | PerpClobBatchUpdateRequest,
  ): Promise<{
    txHash: string;
    identifiedOrders: IdentifiedOrder[] | undefined;
  }> {
    // TODO: Find out how much Compute Units each instruction type uses and batch them in one or multiple transactions
    // TODO: Transfer funds to MangoAccount if necessary
    // TODO: This only work with one order per request, need to refactor to work with multiple orders
    const walletProvider = await this.getProvider(req.address);
    const addressKeyPair = await this._chain.getKeypair(req.address);
    this._tempClient = this.connectMangoClient(addressKeyPair);
    const { perpOrdersToCreate, perpOrdersToCancel } =
      extractPerpOrderParams(req);

    console.log(
      '🪧 -> file: mango.perp.ts:1054 -> MangoClobPerp -> perpOrdersToCreate:',
      perpOrdersToCreate,
    );
    console.log(
      '🪧 -> file: mango.perp.ts:1054 -> MangoClobPerp -> perpOrdersToCancel:',
      perpOrdersToCancel,
    );
    // TODO: Hacky way to identify an order
    if (perpOrdersToCancel.length === 0 && perpOrdersToCreate.length >= 1) {
      const identifiedOrders: IdentifiedOrder[] = [];
      const payload = await this.buildIdentifiablePostOrder(
        this._tempClient,
        walletProvider,
        perpOrdersToCreate,
      );

      const txSignature = await this._tempClient.sendAndConfirmTransaction(
        payload.instructions,
        {
          alts: this.mangoGroup.addressLookupTablesList,
        },
      );

      const mangoAccount = await this.getMangoAccount(
        req.address,
        perpOrdersToCreate[0].market,
      );

      // TODO: this only works if there is only one order in the payload
      const orders = await mangoAccount.loadPerpOpenOrdersForMarket(
        this._client,
        this.mangoGroup,
        this.parsedMarkets[perpOrdersToCreate[0].market].perpMarketIndex,
        true,
      );

      // Check order in orders if expiryTimestamp is the same as the one in payload
      for (const order of orders) {
        for (const identifier of payload.identifiers) {
          if (order.expiryTimestamp.toString() === identifier.expiryTimestamp) {
            identifiedOrders.push({
              clientOrderId: identifier.clientOrderId.toString(),
              exchangeOrderId: order.orderId.toString(),
            });

            this._orderTracker.updateOrderExchangeOrderId(
              identifier.clientOrderId.toString(),
              order.orderId.toString(),
            );

            this._orderTracker.updateOrderStatus(
              identifier.clientOrderId.toString(),
              OrderStatus.OPEN,
              undefined,
            );
          }
        }
      }

      if (identifiedOrders.length === 0) {
        for (const identifier of payload.identifiers) {
          identifiedOrders.push({
            clientOrderId: identifier.clientOrderId.toString(),
            exchangeOrderId: `99999${identifier.clientOrderId.toString()}`,
          });

          this._orderTracker.updateOrderExchangeOrderId(
            identifier.clientOrderId.toString(),
            `99999${identifier.clientOrderId.toString()}`,
          );
        }
        console.warn('Cant find any orders after submitting');
      }

      return { txHash: txSignature.signature, identifiedOrders };
    }

    const instructions = [
      ...(await this.buildDeleteOrder(
        this._tempClient,
        walletProvider,
        perpOrdersToCancel,
      )),
    ];

    const txSignature = await this._tempClient.sendAndConfirmTransaction(
      instructions,
      {
        alts: this.mangoGroup.addressLookupTablesList,
      },
    );

    for (const order of perpOrdersToCancel) {
      this._orderTracker.updateOrderStatusByExchangeOrderId(
        order.orderId,
        OrderStatus.CANCELLED,
      );
    }

    return { txHash: txSignature.signature, identifiedOrders: undefined };
  }
}
