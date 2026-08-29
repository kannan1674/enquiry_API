import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/db.config.js';
import defineTenant from './tenant.js';
import defineUser from './user.js';
import defineOtp from './otp.js';
import defineUserAuthorisedClient from './userAuthorisedClient.js';
import defineTenantChannelAsset from './tenantChannelAsset.js';
import definePipelineStage from './pipelineStage.js';
import defineRoutingRule from './routingRule.js';
import defineUserInvite from './userInvite.js';
import defineQuarantinedInboundEvent from './quarantinedInboundEvent.js';
import defineEnquiry from './enquiry.js';
import defineUserMetaConnection from './userMetaConnection.js';
import defineInboundMessage from './inboundMessage.js';
import defineMetaAppConfig from './metaAppConfig.js';

const sequelize = getSequelize();

export const Tenant = defineTenant(sequelize, DataTypes);
export const User = defineUser(sequelize, DataTypes);
export const Otp = defineOtp(sequelize, DataTypes);
export const UserAuthorisedClient = defineUserAuthorisedClient(sequelize, DataTypes);
export const TenantChannelAsset = defineTenantChannelAsset(sequelize, DataTypes);
export const PipelineStage = definePipelineStage(sequelize, DataTypes);
export const RoutingRule = defineRoutingRule(sequelize, DataTypes);
export const UserInvite = defineUserInvite(sequelize, DataTypes);
export const QuarantinedInboundEvent = defineQuarantinedInboundEvent(sequelize, DataTypes);
export const Enquiry = defineEnquiry(sequelize, DataTypes);
export const UserMetaConnection = defineUserMetaConnection(sequelize, DataTypes);
export const InboundMessage = defineInboundMessage(sequelize, DataTypes);
export const MetaAppConfig = defineMetaAppConfig(sequelize, DataTypes);

const models = {
  Tenant,
  User,
  Otp,
  UserAuthorisedClient,
  TenantChannelAsset,
  PipelineStage,
  RoutingRule,
  UserInvite,
  QuarantinedInboundEvent,
  Enquiry,
  UserMetaConnection,
  InboundMessage,
  MetaAppConfig,
};

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

models.sequelize = sequelize;

export default models;
