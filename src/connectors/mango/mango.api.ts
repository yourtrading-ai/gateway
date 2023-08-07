import {MangoAccount, PerpMarket, Group as MangoGroup} from '@blockworks-foundation/mango-v4';
import axios from 'axios';

const MANGO_DATA_API: string = 'https://api.mngo.cloud/data/';

export async function getPerpTradeHistory(
  mangoAccount: MangoAccount,
  limit: number = 10000,
  skip: number = 0
) {
  // @todo: infer return type with postman request
  const response = await axios.get(
    MANGO_DATA_API + '/v4/stats/perp-trade-history',
    {
      params: {
        'mango-account': mangoAccount.publicKey.toString(),
        limit: limit,
        skip: skip,
      },
    }
  );
  return response.data;
}

export async function getPerpMarketHistory(
  perpMarket: PerpMarket,
  limit: number = 100,
  skip: number = 0
): Promise<Array<any>> {
  // @todo: infer return type with postman request
  const response = await axios.get(
    MANGO_DATA_API + '/v4/stats/perp-market-history',
    {
      params: {
        'perp-market': perpMarket.publicKey.toString(),
        limit: limit,
        skip: skip,
      },
    }
  );
  return response.data;
}

export async function getFundingAccountHourly(
  mangoAccount: MangoAccount,
  limit: number = 100,
  skip: number = 0
) {
  // @todo: infer return type with postman request
  const response = await axios.get(
    MANGO_DATA_API + '/v4/stats/funding-account-hourly',
    {
      params: {
        'mango-account': mangoAccount.publicKey.toString(),
        limit: limit,
        skip: skip,
      },
    }
  );
  return response.data;
}

export async function getOneHourFundingRate(
  mangoGroup: MangoGroup,
  limit: number = 100,
  skip: number = 0
) {
  // @todo: infer return type with postman request
  const response = await axios.get(
    MANGO_DATA_API + '/v4/stats/one-hour-funding-rate',
    {
      params: {
        'mango-group': mangoGroup.publicKey.toString(),
        limit: limit,
        skip: skip,
      },
    }
  );
  return response.data;
}
