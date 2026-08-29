module.exports = (sequelize, DataTypes) => {
  const Otp = sequelize.define(
    'Otp',
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
      otpHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'otp_hash',
      },
      channel: {
        type: DataTypes.ENUM('email', 'mobile'),
        allowNull: false,
      },
      destination: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'verified_at',
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'otps',
      updatedAt: false,
      indexes: [
        {
          name: 'idx_otps_user_active',
          fields: ['user_id', 'verified_at', 'expires_at'],
        },
      ],
    },
  );

  Otp.associate = (models) => {
    Otp.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Otp;
};
