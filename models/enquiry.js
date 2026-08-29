export default (sequelize, DataTypes) => {
  const Enquiry = sequelize.define(
    'Enquiry',
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
      assetId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'asset_id',
      },
      channelType: {
        type: DataTypes.ENUM('facebook_page', 'instagram', 'lead_form', 'whatsapp'),
        allowNull: false,
        field: 'channel_type',
      },
      externalEventId: {
        type: DataTypes.STRING(191),
        allowNull: true,
        field: 'external_event_id',
      },
      pipelineStageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'pipeline_stage_id',
      },
      assigneeUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'assignee_user_id',
      },
      contactName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'contact_name',
      },
      contactEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'contact_email',
      },
      contactPhone: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'contact_phone',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
    },
    {
      tableName: 'enquiries',
      indexes: [
        {
          name: 'idx_enquiry_tenant_stage',
          fields: ['tenant_id', 'pipeline_stage_id'],
        },
        {
          name: 'uq_enquiry_event',
          unique: true,
          fields: ['channel_type', 'external_event_id'],
        },
      ],
    },
  );

  Enquiry.associate = (models) => {
    Enquiry.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Enquiry.belongsTo(models.TenantChannelAsset, { foreignKey: 'assetId' });
    Enquiry.belongsTo(models.PipelineStage, { foreignKey: 'pipelineStageId' });
    Enquiry.belongsTo(models.User, { foreignKey: 'assigneeUserId', as: 'assignee' });
  };

  return Enquiry;
};
