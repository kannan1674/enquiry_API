module.exports = (sequelize, DataTypes) => {
  const UserInvite = sequelize.define(
    'UserInvite',
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
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('client_admin', 'client_manager', 'client_executive'),
        allowNull: false,
        defaultValue: 'client_executive',
      },
      tokenHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'accepted_at',
      },
      invitedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'invited_by',
      },
    },
    {
      tableName: 'user_invites',
      indexes: [
        {
          name: 'idx_invites_tenant_email',
          fields: ['tenant_id', 'email'],
        },
      ],
    },
  );

  UserInvite.associate = (models) => {
    UserInvite.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    UserInvite.belongsTo(models.User, { foreignKey: 'invitedBy', as: 'inviter' });
  };

  return UserInvite;
};
