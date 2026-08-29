module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      tenantId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'tenant_id',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM(
          'agency_super_admin',
          'agency_manager',
          'agency_agent',
          'direct_owner',
          'client_admin',
          'client_manager',
          'client_executive',
          'analyst',
        ),
        allowNull: false,
        defaultValue: 'client_executive',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'locked'),
        allowNull: false,
        defaultValue: 'active',
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login',
      },
      failedAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'failed_attempts',
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password_hash',
      },
    },
    {
      tableName: 'users',
    },
  );

  User.associate = (models) => {
    User.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    User.hasMany(models.Otp, { foreignKey: 'userId' });
    User.hasOne(models.UserMetaConnection, { foreignKey: 'userId' });
    User.hasMany(models.TenantChannelAsset, { foreignKey: 'connectedByUserId', as: 'connectedAssets' });
    User.belongsToMany(models.Tenant, {
      through: models.UserAuthorisedClient,
      foreignKey: 'userId',
      otherKey: 'tenantId',
      as: 'authorisedClients',
    });
  };

  return User;
};
