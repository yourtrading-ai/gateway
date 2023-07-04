import BN from 'bn.js';
import LRUCache from 'lru-cache';
import { Solana } from '../../chains/solana/solana'; // TODO: Add solana chain
import { getSolanaConfig } from '../../chains/solana/solana.config'; // TODO: Add solana chain config
import {
  FundingInfo,
  PerpClobDeleteOrderRequest,
  PerpClobFundingInfoRequest,
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
} from '../../clob/clob.requests';
import { NetworkSelectionRequest } from '../../services/common-interfaces';
import { MangoConfig } from './mango.config';
import {
  MangoClient,
  PerpMarket,
  Group,
  BookSide,
  FillEvent,
  MangoAccount,
} from '@blockworks-foundation/mango-v4';
import { PerpMarketFills } from './mango.types';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';

// TODO: Add these types
// - Orderbook
// - PerpetualMarket
// - DerivativeTrade
// - DerivativeOrderHistory
// - TradeDirection
// - OrderType

// TODO: Investigate what methods we should add in order to manage
//       isolated margin accounts

function enumFromStringValue<T>(
  enm: { [s: string]: T },
  value: string
): T | undefined {
  return (Object.values(enm) as unknown as string[]).includes(value)
    ? (value as unknown as T)
    : undefined;
}

export class MangoClobPerp {
  private static _instances: LRUCache<string, MangoClobPerp>;
  private readonly _chain: Solana;
  private readonly _client: MangoClient;
  public defaultGroup: Group;
  public conf: MangoConfig.NetworkConfig;

  private _ready: boolean = false;
  public parsedMarkets: PerpClobMarkets<PerpMarket> = {};
  // @note: Contains all MangoAccounts, grouped by owner address and base asset
  public mangoAccounts: Record<string, Record<string, Array<MangoAccount>>> =
    {};

  private constructor(_chain: string, network: string) {
    this._chain = Solana.getInstance(network);
    // @todo: See how to handle multiple Keypairs
    this._client = MangoClient.connectDefault(this._chain.rpcUrl);
    this.defaultGroup = MangoConfig.defaultGroup;
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
    //        but we are only supporting one market per group for now. You can change the group in the
    //        config file (mango.defaultGroup)
    const derivativeMarkets = await this._client.perpGetMarkets(group);
    for (const market of derivativeMarkets) {
      const key = market.name;
      this.parsedMarkets[key] = market;
    }
  }

  public async init() {
    if (!this._chain.ready() || Object.keys(this.parsedMarkets).length === 0) {
      await this._chain.init();
      await this.loadMarkets(this.defaultGroup);
      this._ready = true;
    }
  }

  public ready(): boolean {
    return this._ready;
  }

  private async getProvider(address: string): Promise<AnchorProvider> {
    /**
     * Returns a context object for sending transactions with a stored wallet.
     */
    const wallet = new Wallet(await this._chain.getKeypair(address));
    return new AnchorProvider(this._chain.connection, wallet, {
      commitment: 'confirmed',
      maxRetries: 3,
      preflightCommitment: 'confirmed',
      skipPreflight: false,
    });
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
    //@todo: Find out where to get indexed, long-term historic fills & trades
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

    return fills.fills[0].price.toString();
  }

  public async trades(
    req: PerpClobGetTradesRequest
  ): Promise<Array<FillEvent>> {
    const resp = await this.markets(req);
    const market = resp.markets[req.market];
    const fills = await this.loadFills(market);

    const trades = fills.fills.filter((fill) => {
      return (
        fill.maker.toString() === req.address ||
        fill.taker.toString() === req.address
      );
    });

    let targetTrade = undefined;

    if (req.orderId !== undefined) {
      for (const trade of trades) {
        if (
          trade.makerOrderId.toString() === req.orderId ||
          trade.takerOrderId.toString() === req.orderId
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
  ): Promise<Array<DerivativeOrderHistory>> {
    // TODO: Add DerivativeOrderHistory type
    // TODO: Add TradeDirection type
    // TODO: Add fetchOrderHistory method

    const marketId = this.parsedMarkets[req.market].marketId;
    const orderTypes = [];
    if (req.orderTypes) {
      for (const orderTypeString of req.orderTypes.split(',')) {
        const orderType = enumFromStringValue(OrderSide, orderTypeString);
        if (orderType !== undefined) {
          orderTypes.push(orderType);
        }
      }
    }
    let direction = undefined;
    if (req.direction) {
      direction = enumFromStringValue(TradeDirection, req.direction);
    }

    let targetOrder = undefined;

    const orders = await fetchOrderHistory({
      account: req.address,
      marketId,
      direction,
      orderTypes,
    });

    if (req.orderId !== undefined) {
      for (const order of orders) {
        if (order.orderHash === req.orderId) {
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
    // margin = (price * quantity) / leverage
    const priceBig = new BN(price);
    const quantityBig = new BN(quantity);

    return priceBig.mul(quantityBig).divn(leverage);
  }

  // TODO: Review this method
  public async postOrder(
    req: PerpClobPostOrderRequest
  ): Promise<{ txHash: string }> {
    return await this.orderUpdate(req);
  }

  // TODO: Review this method
  public async deleteOrder(
    req: PerpClobDeleteOrderRequest
  ): Promise<{ txHash: string }> {
    return this.orderUpdate(req);
  }

  // TODO: Review this method
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

  public async fundingInfo(
    req: PerpClobFundingInfoRequest
  ): Promise<FundingInfo> {
    // TODO: Rework this method since Mango funding period is just 5 seconds
    //       and people read them as average over some time period
    //       like average per hours or per days
  }

  public async fundingPayments(
    req: PerpClobFundingPaymentsRequest
  ): Promise<Array<FundingPayment>> {
    // TODO: Rework this method since Mango funding settlement is different

    return fundingPayments;
  }

  public async positions(
    req: PerpClobPositionRequest
  ): Promise<Array<Position>> {
    // TODO: Add Position type
    // TODO: Add fetchPositions method
    // TODO: Review this method since we will need to create simulated isolated margin account

    const marketIds = [];
    for (const market of req.markets) {
      marketIds.push(this.parsedMarkets[market].marketId);
    }

    const positions = await fetchPositions({
      marketIds,
      accountID: req.address,
    });

    return positions;
  }

  public buildPostOrder(orderParams: CreatePerpOrderParam[]): PostOrderIx[] {
    // TODO: Add logic for buildPostOrder
    // TODO: Add OrderType type
    const derivativeOrdersToCreate = [];

    return derivativeOrdersToCreate;
  }

  public buildDeleteOrder(
    orders: ClobDeleteOrderRequestExtract[]
  ): { marketId: any; subaccountId: string; orderHash: string }[] {
    const derivativeOrdersToCancel = [];
    // TODO: Add logic for buildDeleteOrder
    return derivativeOrdersToCancel;
  }

  public async orderUpdate(
    req:
      | PerpClobDeleteOrderRequest
      | PerpClobPostOrderRequest
      | PerpClobBatchUpdateRequest
  ): Promise<{ txHash: string }> {
    // TODO: Find out how much Compute Units each instruction type uses and batch them in one or multiple transactions
    // TODO: Use replace order
    const walletProvider = this.getProvider(req.address);
    const mangoAccount = this._client.getMangoAccountsForOwner()
    let derivativeOrdersToCreate: CreatePerpOrderParam[] = [];
    let derivativeOrdersToCancel: ClobDeleteOrderRequestExtract[] = [];
    if ('createOrderParams' in req)
      derivativeOrdersToCreate = derivativeOrdersToCreate.concat(
        req.createOrderParams as CreatePerpOrderParam[]
      );
    if ('price' in req)
      derivativeOrdersToCreate.push({
        price: req.price,
        amount: req.amount,
        orderType: req.orderType,
        side: req.side,
        market: req.market,
        leverage: req.leverage,
      });
    if ('cancelOrderParams' in req)
      derivativeOrdersToCancel = derivativeOrdersToCancel.concat(
        req.cancelOrderParams as ClobDeleteOrderRequestExtract[]
      );
    if ('orderId' in req)
      derivativeOrdersToCancel.push({
        orderId: req.orderId,
        market: req.market,
      });

    const msg = MsgBatchUpdateOrders.fromJSON({
      subaccountId: req.address,
      derivativeOrdersToCreate: this.buildPostOrder(derivativeOrdersToCreate),
      derivativeOrdersToCancel: this.buildDeleteOrder(derivativeOrdersToCancel),
    });

    this._client.perpPlaceOrderV2Ix()

    const txHash = await this._client.sendAndConfirmTransaction([ix], {
      alts: this.defaultGroup.addressLookupTablesList,
    });
    return { txHash };
  }
}
