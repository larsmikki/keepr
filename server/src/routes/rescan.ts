import express from 'express';
import { rescanVault } from '../services/rescanService.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    const deleteMissing = req.body?.deleteMissing === true;
    const result = await rescanVault(deleteMissing);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
