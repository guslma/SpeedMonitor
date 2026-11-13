import express from 'express';
import * as services from '../controller/services.js';
import * as task from '../tasks/services.js';
import password from '../middlewares/password.js';

const app = express.Router();

app.get("/", password(true), async (req, res) => {
    res.json({monitor: task.isRunning(), services: await services.summary()});
});

app.get("/:id/history", password(true), async (req, res) => {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 168);
    res.json(await services.history(req.params.id, hours));
});

// Checks every service now (after the list changed, or to see if something came back)
app.post("/check", password(false), async (req, res) => {
    await task.checkAll(true);
    res.json({monitor: task.isRunning(), services: await services.summary()});
});

export default app;
