'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ObjavaPrice = sequelize.define('ObjavaPrice', {
  id_price:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email_korisnika: { type: DataTypes.STRING,  allowNull: false },
  sadrzaj_url:     { type: DataTypes.TEXT,    allowNull: false },
  lokacija_naziv:  { type: DataTypes.STRING,  allowNull: true },
  vrijeme_objave:  { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
  datum_isteka:    { type: DataTypes.DATE,    allowNull: false },
}, {
  tableName: 'objava_price',
  schema: 'geochat',
  timestamps: false,
});

module.exports = ObjavaPrice;
