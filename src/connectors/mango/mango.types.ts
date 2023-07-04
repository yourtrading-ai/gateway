import { FillEvent } from '@blockworks-foundation/mango-v4';

export type PerpMarketFills = {
  marketName: string;
  fills: FillEvent[];
};
