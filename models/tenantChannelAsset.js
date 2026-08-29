module.exports = (sequelize, DataTypes) => {
  const TenantChannelAsset = sequelize.define(
    'TenantChannelAsset',
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
        allowNull: false,
        field: 'channel_type',
      },
      externalId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'external_id',
      },
      displayName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'display_name',
      },
      status: {
        type: DataTypes.ENUM('active', 'disabled'),
        allowNull: false,
        defaultValue: 'active',
      },
      connectedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'connected_by_user_id',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'tenant_channel_assets',
      indexes: [
        {
          name: 'uq_channel_asset_external',
          unique: true,
          fields: ['channel_type', 'external_id'],
        },
        {
          name: 'idx_channel_asset_tenant',
          fields: ['tenant_id', 'channel_type'],
        },
      ],
    },
  );

  TenantChannelAsset.associate = (models) => {
    TenantChannelAsset.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    TenantChannelAsset.belongsTo(models.User, { foreignKey: 'connectedByUserId', as: 'connectedBy' });
    TenantChannelAsset.hasMany(models.RoutingRule, { foreignKey: 'assetId' });
    TenantChannelAsset.hasMany(models.Enquiry, { foreignKey: 'assetId' });
  };

  return TenantChannelAsset;
};
