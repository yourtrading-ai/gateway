import axios, { AxiosResponse } from 'axios';
import {
  AccountFunding,
  PerpTradeActivity,
  OneHourFundingRate,
  TradeHistory,
} from './mango.types';

export class MangoDataApi {
  private readonly MANGO_DATA_API: string;

  constructor(apiBaseUrl: string) {
    this.MANGO_DATA_API = apiBaseUrl;
  }

  async fetchPerpTradeHistory(
    mangoAccount: string,
    limit: number = 10000,
    offset: number = 0,
    reverseChrono: boolean = true
  ): Promise<Array<PerpTradeActivity>> {
    const response = await axios.get(
      this.MANGO_DATA_API + '/v4/stats/perp-trade-history',
      {
        params: {
          'mango-account': mangoAccount,
          limit,
          offset,
          'rev-chrono': reverseChrono,
        },
      }
    );
    return response.data;
  }

  async fetchPerpMarketHistory(
    perpMarketAccount: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<PerpTradeActivity>> {
    const response = await axios.get(
      this.MANGO_DATA_API + '/v4/stats/perp-market-history',
      {
        params: {
          'perp-market': perpMarketAccount,
          limit,
          offset,
        },
      }
    );
    return response.data;
  }

  async fetchFundingAccountHourly(
    mangoAccount: string,
    startDate?: string
  ): Promise<Record<string, Record<string, AccountFunding>>> {
    const response: AxiosResponse<Record<string, Record<string, any>>> =
      await axios.get(
        this.MANGO_DATA_API + '/v4/stats/funding-account-hourly',
        {
          params: {
            'mango-account': mangoAccount,
            'start-date': startDate,
          },
        }
      );
    return response.data;
  }

  async fetchOneHourFundingRate(
    mangoGroup: string
  ): Promise<Array<OneHourFundingRate>> {
    const response = await axios.get(
      this.MANGO_DATA_API + '/v4/one-hour-funding-rate',
      {
        params: {
          'mango-group': mangoGroup,
        },
      }
    );
    return response.data;
  }

  async fetchTradeHistory(
    mangoAccount: string,
    limit: number = 10000,
    offset: number = 0,
    reverseChrono: boolean = true
  ): Promise<TradeHistory[]> {
    const response = await axios.get(
      this.MANGO_DATA_API + '/v4/stats/trade-history',
      {
        params: {
          'mango-account': mangoAccount,
          limit: limit,
          offset,
          'rev-chrono': reverseChrono,
        },
      }
    );
    return response.data;
  }
}

export const mangoDataApi = new MangoDataApi('https://api.mngo.cloud/data');
export default mangoDataApi;
