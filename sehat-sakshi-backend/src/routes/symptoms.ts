import { Router, Response } from 'express';
import { SymptomLog } from '../models/SymptomLog';
import { protect, AuthRequest } from '../middleware/auth';
import { logDataEvent } from '../utils/auditLogger';
import logger from '../config/logger';

const router = Router();

// Get symptom logs
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)._id;

    logger.debug('Fetching symptom logs', {
      requestId: req.id,
      userId,
    });

    const logs = await SymptomLog.find({ userId }).sort({ createdAt: -1 });

    logDataEvent('READ', userId.toString(), 'symptoms', undefined, req, { count: logs.length });

    res.json(logs);
  } catch (error: any) {
    logger.error('Error fetching symptom logs:', {
      requestId: req.id,
      userId: (req.user as any)._id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Create symptom log
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { symptoms, severity, notes, triageResult } = req.body;
    const userId = (req.user as any)._id;

    const log = await SymptomLog.create({
      userId,
      symptoms,
      severity,
      notes,
      triageResult,
    });

    // Log data creation
    logDataEvent('CREATE', userId.toString(), 'symptoms', log._id.toString(), req, {
      symptoms,
      severity,
    });

    logger.info('Symptom log created', {
      requestId: req.id,
      userId,
      logId: log._id,
      severity,
      symptomCount: symptoms?.length || 0,
    });

    res.status(201).json(log);
  } catch (error: any) {
    logger.error('Error creating symptom log:', {
      requestId: req.id,
      userId: (req.user as any)._id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete symptom log
router.delete('/:id', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)._id;
    const logId = req.params.id;

    const deletedLog = await SymptomLog.findOneAndDelete({ _id: logId, userId });

    if (!deletedLog) {
      logger.warn('Attempted to delete non-existent or unauthorized symptom log', {
        requestId: req.id,
        userId,
        logId,
      });
      res.status(404).json({ message: 'Symptom log not found' });
      return;
    }

    // Log deletion
    logDataEvent('DELETE', userId.toString(), 'symptoms', logId, req);

    logger.info('Symptom log deleted', {
      requestId: req.id,
      userId,
      logId,
    });

    res.json({ message: 'Deleted' });
  } catch (error: any) {
    logger.error('Error deleting symptom log:', {
      requestId: req.id,
      userId: (req.user as any)._id,
      logId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
