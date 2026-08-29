const express = require('express');
const { authenticate, requireRoles, requireTenantAccess, AGENCY_ADMIN_ROLES } = require('../middleware/auth');
const tenantController = require('../controller/tenantController');
const inviteController = require('../controller/inviteController');
const pipelineController = require('../controller/pipelineController');
const assetController = require('../controller/assetController');
const quarantineController = require('../controller/quarantineController');
const enquiryController = require('../controller/enquiryController');
const metaController = require('../controller/metaController');

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

router.post('/meta/setup', authenticate, metaController.setupApp);
router.get('/meta/status', authenticate, metaController.getStatus);
router.get('/meta/connect-url', authenticate, metaController.getConnectUrl);
router.post('/meta/complete', authenticate, metaController.completeLogin);
router.post('/meta/sync', authenticate, metaController.syncConnection);

module.exports = router;
