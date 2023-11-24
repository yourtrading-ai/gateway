import BN from 'bn.js';
import { OrderType, Side } from '../../amm/amm.requests';
import { PerpOrderSide, PerpOrderType } from '@blockworks-foundation/mango-v4';
import ws from 'ws';

export function translateOrderSide(side: Side) {
  switch (side) {
    case 'BUY':
      return PerpOrderSide.bid;
    case 'SELL':
      return PerpOrderSide.ask;
    default:
      throw new Error('Invalid order side');
  }
}

export function translateOrderType(type: OrderType) {
  switch (type) {
    case 'LIMIT':
      return PerpOrderType.limit;
    case 'MARKET':
      return PerpOrderType.market;
    case 'IOC':
      return PerpOrderType.immediateOrCancel;
    case 'POST_ONLY':
      return PerpOrderType.postOnly;
    default:
      throw new Error('Invalid order type');
  }
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export enum OrderStatus {
  CREATED = 'CREATED',
  OPEN = 'OPEN',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  PENDING_CANCEL = 'PENDING_CANCEL',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export type FillEntry = {
  price: number;
  quantity: number;
  fee: number;
  timestamp: number;
};

export type OrderTrackingInfo = {
  clientOrderId: string;
  exchangeOrderId?: string;
  status: OrderStatus;
  price: number;
  orderAmount: number;
  fills: FillEntry[];
  side: Side;
  feeToken?: string;
  createdAt: number;
  updatedAt: number;
  seqNum?: BN;
};

export class OrderTracker {
  private clientOrderIdToTrackingInfo: Map<string, OrderTrackingInfo> =
    new Map();

  public addOrder(
    clientOrderId: string,
    price: number,
    orderAmount: number,
    side: Side,
    createdAt: number,
    updatedAt: number
  ) {
    this.clientOrderIdToTrackingInfo.set(clientOrderId, {
      clientOrderId,
      status: OrderStatus.CREATED,
      price,
      orderAmount,
      fills: [],
      side,
      createdAt,
      updatedAt,
    });
  }

  public updateOrderExchangeOrderId(
    clientOrderId: string,
    exchangeOrderId: string
  ) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      trackingInfo.exchangeOrderId = exchangeOrderId;
    }
  }

  public updateOrderStatus(
    clientOrderId: string,
    status: OrderStatus,
    fillentry?: FillEntry,
    seqNum?: BN
  ) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      trackingInfo.status = status;

      if (fillentry) {
        trackingInfo.fills.push(fillentry);
      }

      trackingInfo.updatedAt = Date.now();
      if (seqNum) trackingInfo.seqNum = seqNum;
    }
  }

  public updateOrderStatusByExchangeOrderId(
    exchangeOrderId: string,
    status: OrderStatus,
    fillentry?: FillEntry,
    seqNum?: BN
  ) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      trackingInfo.status = status;

      if (fillentry) {
        trackingInfo.fills.push(fillentry);
      }

      trackingInfo.updatedAt = Date.now();

      if (seqNum) trackingInfo.seqNum = seqNum;
    }
  }

  public getExchangeOrderId(clientOrderId: string) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      return trackingInfo.exchangeOrderId;
    }

    return undefined;
  }

  public getClientOrderId(exchangeOrderId: string) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      return trackingInfo.clientOrderId;
    }

    return undefined;
  }

  public getOrderTrackingInfo(clientOrderId: string) {
    const trackingInfo = this.clientOrderIdToTrackingInfo.get(clientOrderId);
    if (trackingInfo) {
      return trackingInfo;
    }

    return undefined;
  }

  public getOrderTrackingInfoByExchangeOrderId(exchangeOrderId: string) {
    const trackingInfo = Array.from(
      this.clientOrderIdToTrackingInfo.values()
    ).find((info) => info.exchangeOrderId === exchangeOrderId);
    if (trackingInfo) {
      return trackingInfo;
    }

    return undefined;
  }

  public getAllOrderTrackingInfo() {
    return Array.from(this.clientOrderIdToTrackingInfo.values());
  }

  public getOpenOrderTrackingInfo() {
    return Array.from(this.clientOrderIdToTrackingInfo.values()).filter(
      (info) => info.status !== OrderStatus.CANCELLED
    );
  }

  public getEarlisestSeqNumForOpenOrders() {
    const openOrders = this.getOpenOrderTrackingInfo();
    if (openOrders.length === 0) {
      return undefined;
    }

    return openOrders.reduce((prev, curr) => {
      if (curr.seqNum && prev && curr.seqNum.lt(prev)) {
        return curr.seqNum;
      }

      return prev;
    }, openOrders[0].seqNum);
  }
}

// Websocket utils
// Source: https://github.com/blockworks-foundation/mango-feeds/tree/main/ts/client/src

interface StatusMessage {
  success: boolean;
  message: string;
}

function isStatusMessage(obj: any): obj is StatusMessage {
  return obj.success !== undefined;
}

class ReconnectingWebsocketFeed {
  private _url: string;
  protected _socket: ws;
  private _connected: boolean;
  protected _reconnectionIntervalMs: number;
  protected _reconnectionMaxAttempts: number;
  private _reconnectionAttempts: number;

  private _onConnect: (() => void) | null = null;
  private _onDisconnect:
    | ((reconnectionAttemptsExhausted: boolean) => void)
    | null = null;
  private _onStatus: ((update: StatusMessage) => void) | null = null;
  private _onMessage: ((data: any) => void) | null = null;
  private _pingTimeout: any;

  constructor(
    url: string,
    reconnectionIntervalMs?: number,
    reconnectionMaxAttempts?: number
  ) {
    this._url = url;
    this._socket = new ws(this._url);
    this._reconnectionIntervalMs = reconnectionIntervalMs ?? 5000;
    this._reconnectionMaxAttempts = reconnectionMaxAttempts ?? -1;
    this._reconnectionAttempts = 0;
    this._connected = false;

    this._connect();
  }

  public disconnect() {
    if (this._connected) {
      this._socket.close();
      this._connected = false;
    }
  }

  public connected(): boolean {
    return this._connected;
  }

  public onConnect(callback: () => void) {
    this._onConnect = callback;
  }

  public onDisconnect(
    callback: (reconnectionAttemptsExhausted: boolean) => void
  ) {
    this._onDisconnect = callback;
  }

  public onStatus(callback: (update: StatusMessage) => void) {
    this._onStatus = callback;
  }

  protected onMessage(callback: (data: any) => void) {
    this._onMessage = callback;
  }

  private heartbeat() {
    clearTimeout(this._pingTimeout);
    this._pingTimeout = setTimeout(() => {
      console.log(
        '[MangoFeed] did not receive ping in time -> terminate and reconnect'
      );
      this._socket.terminate();
    }, 30000 + 1000);
  }

  private _connect() {
    this._socket.addEventListener('error', (err: any) => {
      console.warn(`[MangoFeed] connection error: ${err.message}`);
      if (this._reconnectionAttemptsExhausted()) {
        console.error('[MangoFeed] fatal connection error');
        throw err.error;
      }
    });

    this._socket.addEventListener('open', () => {
      console.log('[MangoFeed] connected');
      this._connected = true;
      this._reconnectionAttempts = 0;
      if (this._onConnect) this._onConnect();
    });

    this._socket.addEventListener('close', () => {
      console.log('[MangoFeed] disconnected');
      this._connected = false;
      setTimeout(() => {
        if (!this._reconnectionAttemptsExhausted()) {
          this._reconnectionAttempts++;
          this._connect();
        }
      }, this._reconnectionIntervalMs);
      if (this._onDisconnect)
        this._onDisconnect(this._reconnectionAttemptsExhausted());
    });

    this._socket.addEventListener('message', (msg: any) => {
      try {
        const data = JSON.parse(msg.data);
        if (isStatusMessage(data) && this._onStatus) {
          this._onStatus(data);
        } else if (this._onMessage) {
          this._onMessage(data);
        }
      } catch (err) {
        console.warn('[MangoFeed] error deserializing message', err);
      }
    });

    this._socket.on('ping', () => {
      console.log('[MangoFeed] received ping');
      this.heartbeat();
      this._socket.pong();
    });
  }

  private _reconnectionAttemptsExhausted(): boolean {
    return (
      this._reconnectionMaxAttempts != -1 &&
      this._reconnectionAttempts >= this._reconnectionMaxAttempts
    );
  }
}

interface FillsFeedOptions {
  subscriptions?: FillsFeedSubscribeParams;
  reconnectionIntervalMs?: number;
  reconnectionMaxAttempts?: number;
}

interface FillsFeedSubscribeParams {
  marketId?: string;
  marketIds?: string[];
  account?: string[];
  headUpdates?: boolean;
}

export interface FillEventUpdate {
  status: 'new' | 'revoke';
  marketKey: 'string';
  marketName: 'string';
  slot: number;
  writeVersion: number;
  event: {
    eventType: 'spot' | 'perp';
    maker: 'string';
    taker: 'string';
    takerSide: 'bid' | 'ask';
    timestamp: 'string'; // DateTime
    seqNum: number;
    makerClientOrderId: number;
    takerClientOrderId: number;
    makerFee: number;
    takerFee: number;
    price: number;
    quantity: number;
  };
}

function isFillEventUpdate(obj: any): obj is FillEventUpdate {
  return obj.event !== undefined;
}

interface HeadUpdate {
  head: number;
  previousHead: number;
  headSeqNum: number;
  previousHeadSeqNum: number;
  status: 'new' | 'revoke';
  marketKey: 'string';
  marketName: 'string';
  slot: number;
  writeVersion: number;
}

function isHeadUpdate(obj: any): obj is HeadUpdate {
  return obj.head !== undefined;
}

export class FillsFeed extends ReconnectingWebsocketFeed {
  private _subscriptions?: FillsFeedSubscribeParams;

  private _onFill: ((update: FillEventUpdate) => void) | null = null;
  private _onHead: ((update: HeadUpdate) => void) | null = null;

  constructor(url: string, options?: FillsFeedOptions) {
    super(
      url,
      options?.reconnectionIntervalMs,
      options?.reconnectionMaxAttempts
    );
    this._subscriptions = options?.subscriptions;

    this.onMessage((data: any) => {
      if (isFillEventUpdate(data) && this._onFill) {
        this._onFill(data);
      } else if (isHeadUpdate(data) && this._onHead) {
        this._onHead(data);
      }
    });

    if (this._subscriptions !== undefined) {
      this.subscribe(this._subscriptions);
    }
  }

  public subscribe(subscriptions: FillsFeedSubscribeParams) {
    let retryCount = 0;
    if (this.connected()) {
      const payload = JSON.stringify({
        command: 'subscribe',
        ...subscriptions,
      });
      console.log(
        '🪧 -> file: mango.utils.ts:419 -> FillsFeed -> subscribe -> payload:',
        payload
      );
      this._socket.send(payload);
    } else {
      console.warn(
        `[FillsFeed] attempt to subscribe when not connected, retrying count: ${retryCount}`
      );
      setTimeout(() => {
        if (retryCount <= this._reconnectionMaxAttempts) {
          this.subscribe(subscriptions);
          retryCount++;
        }
      }, this._reconnectionIntervalMs);
    }
  }

  public unsubscribe(marketId: string) {
    if (this.connected()) {
      this._socket.send(
        JSON.stringify({
          command: 'unsubscribe',
          marketId,
        })
      );
    } else {
      console.warn('[FillsFeed] attempt to unsubscribe when not connected');
    }
  }

  public onFill(callback: (update: FillEventUpdate) => void) {
    this._onFill = callback;
  }

  public onHead(callback: (update: HeadUpdate) => void) {
    this._onHead = callback;
  }
}
