import { verifyPolkadotIsAvailable } from '../chains/polkadot/polkadot-middlewares';
import { Polkadot } from '../chains/polkadot/polkadot';

// Add to the router configuration
router.use('/polkadot', verifyPolkadotIsAvailable);
router.get('/polkadot/balances', async (req: Request, res: Response) => {
  const polkadot = Polkadot.getInstance(PolkadotConfig.config.network.name);
  const response = await polkadot.controller.balances(polkadot, req.query);
  res.status(200).json(response);
});

router.get('/polkadot/poll', async (req: Request, res: Response) => {
  const polkadot = Polkadot.getInstance(PolkadotConfig.config.network.name);
  const response = await polkadot.controller.poll(polkadot, req.query);
  res.status(200).json(response);
}); 