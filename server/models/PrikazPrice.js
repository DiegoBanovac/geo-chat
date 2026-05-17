'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const PrikazPrice = sequelize.define('PrikazPrice', {
  id_price:         { type: DataTypes.INTEGER, primaryKey: true },
  email_gledatelja: { type: DataTypes.STRING,  primaryKey: true },
  vrijeme_pregleda: { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
}, {
  tableName: 'prikaz_price',
  schema: 'geochat',
  timestamps: false,
});

module.exports = PrikazPrice;
