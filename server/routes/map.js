import express from 'express';
import * as map from '../controller/map.js';
import { attacks } from '../controller/attacks.js';
import password from '../middlewares/password.js';

const app = express.Router();

app.get("/", password(true), async (req, res) => res.json(await map.map()));

// Where this server is, for the map of a server that added it
app.get("/home", password(true), async (req, res) => res.json(await map.home() || {}));

// Attacks around the world (not against this connection), for the map's optional layer
app.get("/attacks", password(true), async (req, res) => res.json(await attacks()));

export default app;
