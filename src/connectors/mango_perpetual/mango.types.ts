import { FillEvent } from '@blockworks-foundation/mango-v4';

export type PerpMarketFills = {
  marketName: string;
  fills: FillEvent[];
};

export enum TradeType {
  OpenBook = 'openbook_trade', // spot market
  Perp = 'perp_trade', // perp market
}

export type TradeHistory = {
  trade_type: TradeType;
  block_datetime: Date;
  activity_details: PerpTradeActivity | OpenBookTradeActivity;
};

export enum TradeDirection {
  Bid = 'bid',
  Ask = 'ask',
}

// {
//   "signature": "1aWi9VGVQZ7pPmKjdabBMXubuQiH9zS4cGfYrG1qBJMGtua1VGRjsmYjvroVTqPomzM58ZtUjnoVTGxVZQYgfdf",
//   "slot": 231912750,
//   "block_datetime": "2023-11-24T07:14:31.000Z",
//   "maker": "BLgb4NFwhpurMrGX5LQfb8D8dBpGSGtBqqew2Em8uyRT",
//   "maker_client_order_id": "1700810065794702",
//   "maker_fee": -0.0003000000142492354,
//   "taker": "CYo6Sc6cMpzbHzVnvoLAdt8ZpNif9PAJaJG9ymVEv6Gz",
//   "taker_client_order_id": "1700810053082",
//   "taker_fee": 0.0006000000284984708,
//   "taker_side": "bid",
//   "perp_market": "ESdnpnNLgTkBCZRuTJkZLi5wKEZ2z47SG3PJrhundSQ2",
//   "market_index": 2,
//   "price": 57.05,
//   "quantity": 0.05,
//   "seq_num": 2135893,
//   "perp_market_name": "SOL-PERP"
// },
export type PerpTradeActivity = {
  signature: string;
  slot: number;
  block_datetime: string;
  maker: string;
  maker_client_order_id: string;
  maker_fee: number;
  taker: string;
  taker_client_order_id: string;
  taker_fee: number;
  taker_side: TradeDirection;
  perp_market: string;
  market_index: number;
  price: number;
  quantity: number;
  seq_num: number;
  perp_market_name: string | null;
};

/**
 * {
 * 			"signature": "42khzVsvMS3NXJ8KuiCULPGBvBNoz828d9eKn7EXHvDUMimy78yqiHQAkFh47mqUd4W4XdUz9mBZydf4QngajvkH",
 * 			"block_datetime": "2023-03-27T11:07:22.000Z",
 * 			"market": "3BAKsQd3RuhZKES2DGysMhjBdwjZYKYmxRqnSMtZ4KSN",
 * 			"open_orders": "BN3gqDJBMSegQqytx8DDJyyJbGWefmno9XZ8MAUKcxxG",
 * 			"mango_account": "FMa8WDGoZwgJGe2paiDVGnEsBkpuNv3eeycZyQUy9YgB",
 * 			"bid": false,
 * 			"maker": false,
 * 			"referrer_rebate": 218418,
 * 			"order_id": "51631754132782307723804465",
 * 			"client_order_id": "1679915236203",
 * 			"fee_tier": 0,
 * 			"instruction_num": 1,
 * 			"size": 0.039,
 * 			"price": 28002.32,
 * 			"side": "sell",
 * 			"fee_cost": 0.436837,
 * 			"open_orders_owner": "78b8f4cGCwmZ9ysPFMWLaLTkkaYnUjwMJYStWe5RTSSX",
 * 			"base_symbol": "wBTC (Portal)",
 * 			"quote_symbol": "USDC"
 * 		}
 */

export type OpenBookTradeActivity = {
  signature: string;
  block_datetime: string;
  market: string;
  open_orders: string;
  mango_account: string;
  bid: boolean;
  maker: boolean;
  referrer_rebate: number;
  order_id: string;
  client_order_id: string;
  fee_tier: number;
  instruction_num: number;
  size: number;
  price: number;
  side: string;
  fee_cost: number;
  open_orders_owner: string;
  base_symbol: string;
  quote_symbol: string;
};

export type AccountFunding = {
  block_datetime: string;
  long_funding: number;
  short_funding: number;
};

/**
 *  {
 * 		"mango_group": "78b8f4cGCwmZ9ysPFMWLaLTkkaYnUjwMJYStWe5RTSSX",
 * 		"market_index": 0,
 * 		"name": "BTC-PERP",
 * 		"start_of_period": "2023-08-08T09:00:10.000Z",
 * 		"end_of_period": "2023-08-08T10:00:10.000Z",
 * 		"earliest_block_datetime": "2023-08-08T09:00:09.000Z",
 * 		"latest_block_datetime": "2023-08-08T09:59:26.000Z",
 * 		"funding_rate_hourly": -3.7615889821175616e-06
 * 	},
 */
export type OneHourFundingRate = {
  mango_group: string;
  market_index: number;
  name: string;
  start_of_period: string;
  end_of_period: string;
  earliest_block_datetime: string;
  latest_block_datetime: string;
  funding_rate_hourly: number;
};

export type FundingPayment = {
  marketName: string;
  amount: string;
  timestamp: number;
};

export type FundingInfo = {
  marketId: string;
  indexPrice: string;
  markPrice: string;
  fundingRate: string;
  nextFundingTimestamp: number;
};

export type Market = {
  name: string;
  miniumOrderSize: number;
  tickSize: number;
  minQuoteAmountIncrement: number;
  minBaseAmountIncrement: number;
  takerFee: number;
  makerFee: number;
};

export type Position = {
  market: string;
  side: string;
  averageEntryPrice: string;
  unrealizedPnl: string;
  amount: string;
  leverage: string;
};