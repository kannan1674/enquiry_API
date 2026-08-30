export default (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at',
      },
      replacedByTokenId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'replaced_by_token_id',
      },
    },
    {
      tableName: 'refresh_tokens',
      updatedAt: false,
      indexes: [
        {
          name: 'idx_refresh_user',
          fields: ['user_id', 'revoked_at'],
        },
        {
          name: 'idx_refresh_expires',
          fields: ['expires_at'],
        },
      ],
    },
  );

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return RefreshToken;
};
