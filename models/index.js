const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/db.config');

const sequelize = getSequelize();

const Tenant = require('./tenant')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const Otp = require('./otp')(sequelize, DataTypes);
const UserAuthorisedClient = require('./userAuthorisedClient')(sequelize, DataTypes);
const TenantChannelAsset = require('./tenantChannelAsset')(sequelize, DataTypes);
const PipelineStage = require('./pipelineStage')(sequelize, DataTypes);
const RoutingRule = require('./routingRule')(sequelize, DataTypes);
const UserInvite = require('./userInvite')(sequelize, DataTypes);
const QuarantinedInboundEvent = require('./quarantinedInboundEvent')(sequelize, DataTypes);
const Enquiry = require('./enquiry')(sequelize, DataTypes);
const UserMetaConnection = require('./userMetaConnection')(sequelize, DataTypes);

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
};

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

models.sequelize = sequelize;

module.exports = models;
