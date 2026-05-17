'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const IndividualniRazgovor = sequelize.define('IndividualniRazgovor', {
  email_korisnika_1: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    references: { model: 'korisnik', key: 'email_korisnika' },
  },
  email_korisnika_2: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    references: { model: 'korisnik', key: 'email_korisnika' },
  },
  datum_kreiranja: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'individualni_razgovor',
  schema: 'geochat',
  timestamps: false,
});

module.exports = IndividualniRazgovor;
