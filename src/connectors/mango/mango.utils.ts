import { OrderType, Side } from '../../amm/amm.requests';
import { PerpOrderSide, PerpOrderType } from '@blockworks-foundation/mango-v4';

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
