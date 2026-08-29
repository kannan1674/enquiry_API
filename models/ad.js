export default (sequelize, DataTypes) => {
  const Ad = sequelize.define(
    'Ad',
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
      adId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'ad_id',
      },
      adName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'ad_name',
      },
      campaignId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'campaign_id',
      },
      campaignName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'campaign_name',
      },
      dailyBudget: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'daily_budget',
      },
      lifetimeBudget: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'lifetime_budget',
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'INR',
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      isTest: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_test',
      },
    },
    {
      tableName: 'ads',
    },
  );

  Ad.associate = (models) => {
    Ad.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
  };

  return Ad;
};
