import { PipelineStage, RoutingRule, User } from '../models/index.js';
import { CHANNEL_TYPES, isChannelType } from '../services/inboundRouter.js';

function serializeStage(stage) {
  return {
    id: stage.id,
    tenantId: stage.tenantId,
    name: stage.name,
    sortOrder: stage.sortOrder,
    isDefault: Boolean(stage.isDefault),
  };
}

async function listPipeline(req, res, next) {
  try {
    const stages = await PipelineStage.findAll({
      where: { tenantId: req.tenantId },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    const rules = await RoutingRule.findAll({
      where: { tenantId: req.tenantId },
      order: [['id', 'ASC']],
    });
    return res.json({
      success: true,
      stages: stages.map(serializeStage),
      routingRules: rules,
    });
  } catch (error) {
    return next(error);
  }
}

async function createStage(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'Stage name is required' });
    }

    const last = await PipelineStage.findOne({
      where: { tenantId: req.tenantId },
      order: [['sortOrder', 'DESC']],
    });
    const isDefault = Boolean(req.body?.isDefault) || !last;
    if (isDefault) {
      await PipelineStage.update({ isDefault: false }, { where: { tenantId: req.tenantId } });
    }

    const stage = await PipelineStage.create({
      tenantId: req.tenantId,
      name,
      sortOrder: last ? last.sortOrder + 1 : 0,
      isDefault,
    });

    return res.status(201).json({ success: true, stage: serializeStage(stage) });
  } catch (error) {
    return next(error);
  }
}

async function updateStage(req, res, next) {
  try {
    const stage = await PipelineStage.findOne({
      where: { id: req.params.stageId, tenantId: req.tenantId },
    });
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' });
    }

    const updates = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      updates.name = req.body.name.trim();
    }
    if (Number.isInteger(req.body?.sortOrder) || Number.isInteger(Number(req.body?.sortOrder))) {
      updates.sortOrder = Number(req.body.sortOrder);
    }
    if (req.body?.isDefault === true) {
      await PipelineStage.update({ isDefault: false }, { where: { tenantId: req.tenantId } });
      updates.isDefault = true;
    }

    await stage.update(updates);
    return res.json({ success: true, stage: serializeStage(stage) });
  } catch (error) {
    return next(error);
  }
}

async function deleteStage(req, res, next) {
  try {
    const stage = await PipelineStage.findOne({
      where: { id: req.params.stageId, tenantId: req.tenantId },
    });
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' });
    }
    if (stage.isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default stage' });
    }
    await stage.destroy();
    return res.json({ success: true, message: 'Stage deleted' });
  } catch (error) {
    return next(error);
  }
}

async function upsertRoutingRule(req, res, next) {
  try {
    const pipelineStageId = Number(req.body?.pipelineStageId);
    const channelType = req.body?.channelType || null;
    const assetId = req.body?.assetId ? Number(req.body.assetId) : null;
    const assigneeUserId = req.body?.assigneeUserId ? Number(req.body.assigneeUserId) : null;

    if (!pipelineStageId) {
      return res.status(400).json({ success: false, message: 'Pipeline stage is required' });
    }

    const stage = await PipelineStage.findOne({
      where: { id: pipelineStageId, tenantId: req.tenantId },
    });
    if (!stage) {
      return res.status(400).json({ success: false, message: 'Invalid pipeline stage' });
    }

    if (channelType && !isChannelType(channelType)) {
      return res.status(400).json({ success: false, message: 'Invalid channel type' });
    }

    if (assigneeUserId) {
      const assignee = await User.findOne({ where: { id: assigneeUserId, tenantId: req.tenantId } });
      if (!assignee) {
        return res.status(400).json({ success: false, message: 'Assignee must belong to this client' });
      }
    }

    const where = {
      tenantId: req.tenantId,
      channelType: channelType || null,
      assetId: assetId || null,
    };

    const [rule] = await RoutingRule.findOrCreate({
      where,
      defaults: {
        ...where,
        pipelineStageId,
        assigneeUserId,
      },
    });

    await rule.update({ pipelineStageId, assigneeUserId });
    return res.json({ success: true, routingRule: rule });
  } catch (error) {
    return next(error);
  }
}

export {
  CHANNEL_TYPES,
  listPipeline,
  createStage,
  updateStage,
  deleteStage,
  upsertRoutingRule,
};
