import express from 'express';
import { authenticate, requireRoles, requireTenantAccess, AGENCY_ADMIN_ROLES } from '../middleware/auth.js';
import * as tenantController from '../controller/tenantController.js';
import * as inviteController from '../controller/inviteController.js';
import * as pipelineController from '../controller/pipelineController.js';
import * as assetController from '../controller/assetController.js';
import * as quarantineController from '../controller/quarantineController.js';
import * as enquiryController from '../controller/enquiryController.js';
import * as adsController from '../controller/adsController.js';

const router = express.Router();
const tenantAccess = [authenticate, requireTenantAccess('tenantId')];
const agencyAdmin = [authenticate, requireRoles(...AGENCY_ADMIN_ROLES)];

router.get('/tenants', agencyAdmin, tenantController.listTenants);
router.post('/tenants', agencyAdmin, tenantController.createTenant);
router.get('/tenants/:tenantId', tenantAccess, tenantController.getTenant);
router.patch('/tenants/:tenantId', [...agencyAdmin, requireTenantAccess('tenantId')], tenantController.updateTenant);
router.get('/tenants/:tenantId/users', tenantAccess, tenantController.listTenantUsers);

router.get('/tenants/:tenantId/invites', tenantAccess, inviteController.listInvites);
router.post('/tenants/:tenantId/invites', tenantAccess, inviteController.createInvite);

router.get('/tenants/:tenantId/pipeline', tenantAccess, pipelineController.listPipeline);
router.post('/tenants/:tenantId/pipeline/stages', tenantAccess, pipelineController.createStage);
router.patch('/tenants/:tenantId/pipeline/stages/:stageId', tenantAccess, pipelineController.updateStage);
router.delete('/tenants/:tenantId/pipeline/stages/:stageId', tenantAccess, pipelineController.deleteStage);
router.post('/tenants/:tenantId/pipeline/routing', tenantAccess, pipelineController.upsertRoutingRule);

router.get('/tenants/:tenantId/assets', tenantAccess, assetController.listAssets);
router.post('/tenants/:tenantId/assets', tenantAccess, assetController.createAsset);
router.patch('/tenants/:tenantId/assets/:assetId', tenantAccess, assetController.updateAsset);
router.delete('/tenants/:tenantId/assets/:assetId', tenantAccess, assetController.deleteAsset);

router.get('/quarantine', agencyAdmin, quarantineController.listQuarantine);
router.post('/quarantine/:id/map', agencyAdmin, quarantineController.mapQuarantine);
router.post('/quarantine/:id/dismiss', agencyAdmin, quarantineController.dismissQuarantine);

router.get('/enquiries', authenticate, enquiryController.listEnquiries);
router.post('/enquiries/sync', authenticate, enquiryController.syncInbound);

router.get('/ads/report', authenticate, adsController.getAdsReport);
router.get('/ads/:adId', authenticate, adsController.getAdReport);

export default router;
