'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Battle = sequelize.define('Battle', {
  id_battle:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  naziv_grupe:     { type: DataTypes.STRING,  allowNull: true },
  naziv_izazova:   { type: DataTypes.STRING,  allowNull: true },
  ir_email_1:      { type: DataTypes.STRING,  allowNull: true },
  ir_email_2:      { type: DataTypes.STRING,  allowNull: true },
  status_bitke:    { type: DataTypes.STRING,  defaultValue: 'u_tijeku' },
  datum_pocetka:   { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
  datum_zavrsetka: { type: DataTypes.DATE,    allowNull: true },
  bodovi_ir_1:     { type: DataTypes.INTEGER, defaultValue: 0 },
  bodovi_ir_2:     { type: DataTypes.INTEGER, defaultValue: 0 },
  pobjednik_email: { type: DataTypes.STRING,  allowNull: true },
}, {
  tableName: 'battle',
  schema: 'geochat',
  timestamps: false,
});

module.exports = Battle;
