# geo-chat

A full-stack real-time location-based chat application built for the Software Engineering course at the University of Applied Sciences of Rijeka.

## About

geo-chat allows users to communicate and play games based on their geographic location. The app combines a modern React frontend with a Node.js backend powered by Express and PostgreSQL, using Sequelize ORM for database management.

## Tech Stack

**Frontend**
- React 19
- TailwindCSS 4
- Vite

**Backend**
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM

## Project Structure

```
geo-chat/
  src/        # React frontend source
  server/     # Express backend
    models/   # Sequelize models
    routes/   # API routes
  public/     # Static assets
```

## Getting Started

**Frontend**
```bash
npm install
npm run dev
```

**Backend**
```bash
cd server
npm install
npm run dev
```

Make sure to configure your PostgreSQL connection in a `.env` file inside the `server/` directory.

## Course

Built as part of the Software Engineering course (Programsko inzenjerstvo) at Veluciliste u Rijeci.
