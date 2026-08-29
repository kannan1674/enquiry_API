module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define(
    'Tenant',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      clientCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        field: 'client_code',
      },
      companyName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'company_name',
      },
      status: {
        type: DataTypes.ENUM('active', 'suspended', 'archived'),
        allowNull: false,
        defaultValue: 'active',
      },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'Asia/Kolkata',
      },
      accountType: {
        type: DataTypes.ENUM('direct', 'agency_client'),
        allowNull: false,
        defaultValue: 'agency_client',
        field: 'account_type',
      },
      agencyOwnerUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'agency_owner_user_id',
      },
      ownerUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'owner_user_id',
      },
    },
    {
      tableName: 'tenants',
    },
  );

  Tenant.associate = (models) => {
    Tenant.hasMany(models.User, { foreignKey: 'tenantId' });
    Tenant.belongsToMany(models.User, {
      through: models.UserAuthorisedClient,
      foreignKey: 'tenantId',
      otherKey: 'userId',
      as: 'authorisedUsers',
    });
    Tenant.hasMany(models.TenantChannelAsset, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.PipelineStage, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.RoutingRule, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.UserInvite, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Enquiry, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.InboundMessage, { foreignKey: 'clientId', as: 'inboundMessages' });
  };

  return Tenant;
};
