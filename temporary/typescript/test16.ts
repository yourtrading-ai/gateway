// npx tsx temporary/typescript/test16.ts

import { address, beginCell, storeMessage, TonClient } from '@ton/ton';

const tonClient = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: '7e4931f05b6240e0c86f7ffa1003ecda505872f546c2829f560e48ebc3196c66',
});

const WalletAddress = 'UQBSevYG7uExE6wJnWC2adG2SqcjUUqNlmfeTRMFhHT3kWfd';

const waitTransaction = async () => {
  const transactions = await tonClient.getTransactions(address(WalletAddress), {
    limit: 1,
  });

  const tx = transactions[0];

  //@ts-ignore
  const msgCell = beginCell().store(storeMessage(tx.inMessage)).endCell();
  const inMsgHash = msgCell.hash().toString('base64');

  const jsonString = Buffer.from(inMsgHash, 'base64').toString('utf-8');
  const objeto = JSON.parse(jsonString);


  console.log(objeto);
};

waitTransaction();
