export default (sequelize, DataTypes) => {
  const MetaAppConfig = sequelize.define(
    'MetaAppConfig',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      appId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'app_id',
      },
      appSecretEncrypted: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'app_secret_encrypted',
      },
      configId: {
        type: DataTypes.STRING(128),
        allowNull: true,
        field: 'config_id',
      },
      graphVersion: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'v21.0',
        field: 'graph_version',
      },
    },
    {
      tableName: 'meta_app_configs',
    },
  );

  return MetaAppConfig;
};
