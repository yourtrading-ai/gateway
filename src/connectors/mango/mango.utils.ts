import { TradeHistory } from './mango.types';
import axios from 'axios';

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
