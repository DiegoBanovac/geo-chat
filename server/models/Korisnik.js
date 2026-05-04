'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Korisnik = sequelize.define('Korisnik', {
  email_korisnika:   { type: DataTypes.STRING,   primaryKey: true, allowNull: false },
  lozinka_korisnika: { type: DataTypes.STRING,   allowNull: false },
  ime_korisnika:     { type: DataTypes.STRING,   allowNull: false },
  prezime_korisnika: { type: DataTypes.STRING,   allowNull: false },
  datum_rodenja:     { type: DataTypes.DATEONLY, allowNull: true },
  slika_profila:     { type: DataTypes.STRING,   allowNull: true, defaultValue: '' },
}, {
  tableName: 'korisnik',
  timestamps: false,
});

module.exports = Korisnik;
