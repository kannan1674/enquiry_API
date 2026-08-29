export default (sequelize, DataTypes) => {
  const QuarantinedInboundEvent = sequelize.define(
    'QuarantinedInboundEvent',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      channelType: {
        type: DataTypes.ENUM('facebook_page', 'instagram', 'lead_form', 'whatsapp'),
        allowNull: false,
        field: 'channel_type',
      },
      externalAssetId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'external_asset_id',
      },
      externalEventId: {
        type: DataTypes.STRING(191),
        allowNull: true,
        field: 'external_event_id',
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'mapped', 'dismissed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      resolvedTenantId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'resolved_tenant_id',
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'received_at',
      },
    },
    {
      tableName: 'quarantined_inbound_events',
      indexes: [
        {
          name: 'idx_quarantine_status_received',
          fields: ['status', 'received_at'],
        },
        {
          name: 'idx_quarantine_asset',
          fields: ['channel_type', 'external_asset_id'],
        },
      ],
    },
  );

  QuarantinedInboundEvent.associate = (models) => {
    QuarantinedInboundEvent.belongsTo(models.Tenant, {
      foreignKey: 'resolvedTenantId',
      as: 'resolvedTenant',
    });
  };

  return QuarantinedInboundEvent;
};
