import { buildAdsReport } from '../services/adsReport.js';

export async function getAdsReport(req, res, next) {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : null;
    const adId = typeof req.query.adId === 'string' ? req.query.adId.trim() : '';

    const report = await buildAdsReport({
      user: req.user,
      tenantId,
      adId: adId || null,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
    });

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAdReport(req, res, next) {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : null;
    const report = await buildAdsReport({
      user: req.user,
      tenantId,
      adId: req.params.adId,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
    });

    const ad = report.ads[0] || null;
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'No queries found for this ad in the selected dates',
      });
    }

    return res.status(200).json({
      success: true,
      startDate: report.startDate,
      endDate: report.endDate,
      timezone: report.timezone,
      ad,
    });
  } catch (error) {
    return next(error);
  }
}
