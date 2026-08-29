module.exports = (sequelize, DataTypes) => {
  const UserMetaConnection = sequelize.define(
    'UserMetaConnection',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'user_id',
      },
      facebookUserId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'facebook_user_id',
      },
      facebookName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'facebook_name',
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'access_token',
      },
      tokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'token_expires_at',
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_synced_at',
      },
    },
    {
      tableName: 'user_meta_connections',
    },
  );

  UserMetaConnection.associate = (models) => {
    UserMetaConnection.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return UserMetaConnection;
};
