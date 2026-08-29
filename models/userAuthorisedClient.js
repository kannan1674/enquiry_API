module.exports = (sequelize, DataTypes) => {
  const UserAuthorisedClient = sequelize.define(
    'UserAuthorisedClient',
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'user_id',
      },
      tenantId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'tenant_id',
      },
    },
    {
      tableName: 'user_authorised_clients',
      timestamps: false,
    },
  );

  return UserAuthorisedClient;
};
