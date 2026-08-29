export default (sequelize, DataTypes) => {
  const RoutingRule = sequelize.define(
    'RoutingRule',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      tenantId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'tenant_id',
      },
      channelType: {
        type: DataTypes.ENUM('facebook_page', 'instagram', 'lead_form', 'whatsapp'),
        allowNull: true,
        field: 'channel_type',
      },
      assetId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'asset_id',
      },
      pipelineStageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'pipeline_stage_id',
      },
      assigneeUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'assignee_user_id',
      },
    },
    {
      tableName: 'routing_rules',
    },
  );

  RoutingRule.associate = (models) => {
    RoutingRule.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    RoutingRule.belongsTo(models.TenantChannelAsset, { foreignKey: 'assetId' });
    RoutingRule.belongsTo(models.PipelineStage, { foreignKey: 'pipelineStageId' });
    RoutingRule.belongsTo(models.User, { foreignKey: 'assigneeUserId', as: 'assignee' });
  };

  return RoutingRule;
};
