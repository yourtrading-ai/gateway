import { TradeHistory } from './mango.types';
import axios from 'axios';
import { OrderType, Side } from '../../amm/amm.requests';
import { PerpOrderSide, PerpOrderType } from '@blockworks-foundation/mango-v4';

// API sample url:
// https://api.mngo.cloud/data/v4/stats/trade-history?mango-account=CAUkgX2dcsmLNrswsvepcKDwAmtVst8pWb1NUekBBeM

export async function getTradeHistory(
  mangoAccount: string
): Promise<TradeHistory[]> {
  try {
    const url = `https://api.mngo.cloud/data/v4/stats/trade-history?mango-account=${mangoAccount}`;
    const response = await axios.get(url);

    if (response.status === 200) {
      const tradeHistory: TradeHistory[] = response.data;
      return tradeHistory;
    } else {
      throw new Error('Failed to fetch trade history');
    }
  } catch (error) {
    console.error(error);
    throw new Error('An error occurred while fetching trade history');
  }
}

export async function translateOrderSide(side: Side) {
  switch (side) {
    case 'BUY':
      return PerpOrderSide.bid;
    case 'SELL':
      return PerpOrderSide.ask;
    default:
      throw new Error('Invalid order side');
  }
}

export async function translateOrderType(type: OrderType) {
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
