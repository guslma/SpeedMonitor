import express from 'express';
import * as outages from '../controller/outages.js';
import * as plan from '../controller/plan.js';
import password from '../middlewares/password.js';

const app = express.Router();

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

app.get("/", password(true), async (req, res) => {
    const {from, to} = req.query;
    if (!validDate(from) || !validDate(to))
        return res.status(400).json({message: "Provide 'from' and 'to' dates as YYYY-MM-DD"});

    res.json({...await outages.summary(from, to), plan: await plan.summary(from, to)});
});

export default app;
