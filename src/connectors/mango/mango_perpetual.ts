import { BigNumber, utils } from 'ethers';
import LRUCache from 'lru-cache';
import { OrderSide } from '@injectivelabs/networks/node_modules/@injectivelabs/ts-types/dist/cjs/trade';
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
} from '../../clob/clob.requests';
import { NetworkSelectionRequest } from '../../services/common-interfaces';
import { MangoConfig } from './mango.config';

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
  private _chain;
  public conf;

  private _ready: boolean = false;
  public parsedMarkets: PerpClobMarkets = {};

  private constructor(_chain: string, network: string) {
    this._chain = Solana.getInstance(network);
    this.conf = MangoConfig.config;
  }

  public static getInstance(chain: string, network: string): MangoClobPerp {
    if (MangoClobPerp._instances === undefined) {
      const config = getSolanaConfig(network);
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

  public async loadMarkets() {
    const derivativeMarkets = []; // TODO: Add function to get derivative markets
    for (const market of derivativeMarkets) {
      const key = market.ticker.replace('/', '-').replace(' PERP', '');
      this.parsedMarkets[key] = <PerpetualMarket>market; // TODO: Add PerpetualMarket type
    }
  }

  public async init() {
    if (!this._chain.ready() || Object.keys(this.parsedMarkets).length === 0) {
      await this._chain.init();
      await this.loadMarkets();
      this._ready = true;
    }
  }

  public ready(): boolean {
    return this._ready;
  }

  public async markets(
    req: PerpClobMarketRequest
  ): Promise<{ markets: PerpClobMarkets }> {
    if (req.market && req.market.split('-').length === 2) {
      const resp: PerpClobMarkets = {};

      resp[req.market] = this.parsedMarkets[req.market];
      return { markets: resp };
    }
    return { markets: this.parsedMarkets };
  }

  public async orderBook(req: PerpClobOrderbookRequest): Promise<Orderbook> {
    // TODO: Add Orderbook type
    // TODO: Add getOrderBook method
    return await getOrderBook(this.parsedMarkets[req.market].marketId);
  }

  public async ticker(
    req: PerpClobTickerRequest
  ): Promise<{ markets: PerpClobMarkets }> {
    return await this.markets(req);
  }

  public async lastTradePrice(
    req: PerpClobGetLastTradePriceRequest
  ): Promise<string | null> {
    // TODO: Add fecthLastTradePrice method
    const marketInfo = this.parsedMarkets[req.market];
    const marketId = marketInfo.marketId;
    const price = fecthLastTradePrice(marketId);

    return price;
  }

  public async trades(
    req: PerpClobGetTradesRequest
  ): Promise<Array<DerivativeTrade>> {
    // TODO: Add DerivativeTrade type
    // TODO: Add fetchTrades method
    const marketId = this.parsedMarkets[req.market].marketId;

    const trades = await fetchTrades({
      marketId,
      account: req.address,
    });

    let targetTrade = undefined;

    if (req.orderId !== undefined) {
      for (const trade of trades) {
        if (trade.orderHash === req.orderId) {
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

  // TODO: Check if Mango use BigNumber
  public static calculateMargin(
    price: string,
    quantity: string,
    decimals: number,
    leverage: number
  ): BigNumber {
    // margin = (price * quantity) / leverage
    const priceBig = utils.parseUnits(price, decimals);
    const quantityBig = utils.parseUnits(quantity, decimals);
    const leverageBig = utils.parseUnits(leverage.toString(), decimals);
    const decimalsBig = BigNumber.from(10).pow(decimals);

    const numerator = priceBig.mul(quantityBig).mul(decimalsBig);
    const denominator = leverageBig.mul(decimalsBig);

    return numerator.div(denominator);
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

  // TODO: Review this method
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

  private _getNextHourUnixTimestamp(): number {
    // Returns the next hour unix timestamp in seconds.
    const now = Date.now() * 1e-3;
    return (now - (now % 3600) + 3600) * 1e3;
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
    // TODO: Rework this method since Mango funnding settlement is different

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

  public buildPostOrder(orderParams: CreatePerpOrderParam[]): {
    orderType: OrderType;
    price: string;
    quantity: string;
    marketId: any;
    feeRecipient: string;
    margin: string;
  }[] {
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
    // TODO: Rework this method to fit Mango
    const wallet = await this._chain.getWallet(req.address);
    const privateKey: string = wallet.privateKey;
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

    const { txHash } = await this._chain.broadcaster(privateKey).broadcast({
      msgs: msg,
    });
    return { txHash };
  }
}
