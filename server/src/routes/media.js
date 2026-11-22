import { Router } from 'express';
import mongoose from 'mongoose';
import { Media } from '../models/Media.js';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    const media = await Media.findById(id).lean();
    if (!media || !media.data) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    const buffer = Buffer.isBuffer(media.data)
      ? media.data
      : Buffer.from(media.data.buffer || media.data);

    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });

    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

export default router;
