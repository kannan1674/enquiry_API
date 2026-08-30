export default (sequelize, DataTypes) => {
  const LoginAttempt = sequelize.define(
    'LoginAttempt',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'ip_address',
      },
      failedCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'failed_count',
      },
      blockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'blocked_until',
      },
    },
    {
      tableName: 'login_attempts',
    },
  );

  return LoginAttempt;
};
