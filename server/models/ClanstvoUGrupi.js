'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClanstvoUGrupi = sequelize.define('ClanstvoUGrupi', {
  email_korisnika: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    references: { model: 'korisnik', key: 'email_korisnika' },
  },
  naziv_grupe: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    references: { model: 'grupni_razgovor', key: 'naziv_grupe' },
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'clanstvo_u_grupi',
  schema: 'geochat',
  timestamps: false,
});

module.exports = ClanstvoUGrupi;
