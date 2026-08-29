export default (sequelize, DataTypes) => {
  const InboundMessage = sequelize.define(
    'InboundMessage',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: null,
        field: 'client_id',
      },
      source: {
        type: DataTypes.ENUM('whatsapp', 'facebook', 'instagram'),
        allowNull: false,
      },
      externalId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'external_id',
      },
      customerName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        field: 'customer_name',
      },
      customerNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: '',
        field: 'customer_number',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      whatsappMessageId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        defaultValue: '',
        field: 'whatsapp_message_id',
      },
      status: {
        type: DataTypes.ENUM('new', 'read', 'replied', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      },
      rawPayload: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        field: 'raw_payload',
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'received_at',
      },
    },
    {
      tableName: 'inbound_messages',
      indexes: [
        {
          name: 'idx_inbound_received_at',
          fields: ['received_at'],
        },
        {
          name: 'idx_inbound_source_external',
          fields: ['source', 'external_id'],
        },
        {
          name: 'idx_inbound_status',
          fields: ['status'],
        },
      ],
    },
  );

  InboundMessage.associate = (models) => {
    InboundMessage.belongsTo(models.Tenant, {
      foreignKey: 'clientId',
      as: 'client',
    });
  };

  return InboundMessage;
};
