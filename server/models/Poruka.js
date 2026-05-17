'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Poruka = sequelize.define('Poruka', {
  id_poruke: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  posiljatelj_email: { type: DataTypes.STRING, allowNull: false },
  naziv_grupe:       { type: DataTypes.STRING, allowNull: true },
  primatelj_email:   { type: DataTypes.STRING, allowNull: true },
  vrijeme_slanja:    { type: DataTypes.DATE,   defaultValue: DataTypes.NOW },
  poruka_tekst:      { type: DataTypes.TEXT,   allowNull: true },
  poruka_medij_url:  { type: DataTypes.TEXT,   allowNull: true },
  tip_medija:        { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'poruka',
  schema: 'geochat',
  timestamps: false,
});

module.exports = Poruka;
