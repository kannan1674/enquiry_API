export default (sequelize, DataTypes) => {
  const PipelineStage = sequelize.define(
    'PipelineStage',
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
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'sort_order',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
    },
    {
      tableName: 'pipeline_stages',
      indexes: [
        {
          name: 'idx_pipeline_tenant_order',
          fields: ['tenant_id', 'sort_order'],
        },
      ],
    },
  );

  PipelineStage.associate = (models) => {
    PipelineStage.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    PipelineStage.hasMany(models.RoutingRule, { foreignKey: 'pipelineStageId' });
    PipelineStage.hasMany(models.Enquiry, { foreignKey: 'pipelineStageId' });
  };

  return PipelineStage;
};
