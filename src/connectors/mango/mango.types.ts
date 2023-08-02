import { FillEvent } from '@blockworks-foundation/mango-v4';

export type PerpMarketFills = {
  marketName: string;
  fills: FillEvent[];
};

export type TradeHistory = {
  trade_type: string;
  block_datetime: string;
  activity_details: {
    signature: string;
    slot: number;
    block_datetime: string;
    maker: string;
    maker_order_id: string | null;
    maker_fee: number;
    taker: string;
    taker_order_id: string | null;
    taker_client_order_id: string;
    taker_fee: number;
    taker_side: TradeDirection;
    perp_market: string;
    market_index: number;
    price: number;
    quantity: number;
    seq_num: number;
  };
};

export enum TradeDirection {
  Bid = 'bid',
  Ask = 'ask',
}
