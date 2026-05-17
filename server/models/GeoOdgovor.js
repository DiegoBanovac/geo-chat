'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const GeoOdgovor = sequelize.define('GeoOdgovor', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_battle:     { type: DataTypes.INTEGER, allowNull: false },
  broj_runde:    { type: DataTypes.INTEGER, allowNull: false },
  email_igraca:  { type: DataTypes.STRING,  allowNull: false },
  guess_lat:     { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  guess_lng:     { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  bodovi:        { type: DataTypes.INTEGER, defaultValue: 0 },
  udaljenost_km: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  submitted_at:  { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
}, {
  tableName: 'geo_odgovor',
  schema: 'geochat',
  timestamps: false,
});

module.exports = GeoOdgovor;
