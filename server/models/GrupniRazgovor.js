'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const GrupniRazgovor = sequelize.define('GrupniRazgovor', {
  naziv_grupe: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  slika_grupe: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  datum_kreiranja: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'grupni_razgovor',
  schema: 'geochat',
  timestamps: false,
});

module.exports = GrupniRazgovor;
