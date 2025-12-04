// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session'); //For user sessions
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global process-level handlers to log unhandled errors so they appear in the terminal
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason && (reason.stack || reason));
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && (err.stack || err));
    // Exit after uncaught exception to avoid unknown state
    process.exit(1);
});

// app.listen(PORT, () => {
   //  console.log('Server running on port ${PORT}');
// });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'))

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret', // keep secret in .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,       // set true in production with HTTPS
        maxAge: 15*60*1000   // 15 minutes (in milliseconds)
    } 
}));

// Routes
const indexRoute = require('./routes/index');
const usersRoute = require('./routes/users');
const passwordRoute = require('./routes/password');
const servicesRoute = require('./routes/services');
const ordersRoute = require('./routes/orders');
const billingRoute = require('./routes/billing');
const supportRoute = require('./routes/support');
const adminRoute = require('./routes/admin');

app.use('/password', passwordRoute);
app.use('/', indexRoute);
app.use('/users', usersRoute);
app.use('/services', servicesRoute);
app.use('/orders', ordersRoute);
app.use('/billing', billingRoute);
app.use('/support', supportRoute);
app.use('/admin', adminRoute);

// Redirect /services to booking page in case someone hits the base path
app.get('/services', (req, res) => {
    res.redirect('/services/book');
});

// Diagnostic: list registered routes (helpful for debugging during development)
app.get('/__routes', (req, res) => {
    try {
        const routes = [];
        app._router.stack.forEach(mw => {
            if (mw.route) {
                const methods = Object.keys(mw.route.methods).join(',').toUpperCase();
                routes.push(`${methods} ${mw.route.path}`);
            } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
                mw.handle.stack.forEach(r => {
                    if (r.route) {
                        const methods = Object.keys(r.route.methods).join(',').toUpperCase();
                        routes.push(`${methods} ${r.route.path}`);
                    }
                });
            }
        });
        res.set('Content-Type', 'text/plain');
        res.send(routes.join('\n'));
    } catch (err) {
        res.status(500).send('Could not list routes');
    }
});

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client and dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

async function main() {
    try {
        if (!uri) {
            console.error('\nMissing MONGO_URI environment variable.\nPlease create a MongoDB cluster (Atlas or local), obtain the connection string, and set MONGO_URI in your .env file.\nExample .env entry:\nMONGO_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"\n');
            process.exit(1);
        }

        await client.connect();
        console.log("Connected to MongoDB");
        // Ensure required collections exist (helps when connecting to a fresh DB)
        const db = client.db(app.locals.dbName || 'ecommerceDB');
        const requiredCollections = ['users', 'services', 'orders', 'payments', 'supportTickets'];
        const existing = await db.listCollections({}, { nameOnly: true }).toArray();
        const existingNames = existing.map(c => c.name);
        for (const name of requiredCollections) {
            if (!existingNames.includes(name)) {
                try {
                    await db.createCollection(name);
                    console.log(`Created collection: ${name}`);
                } catch (e) {
                    console.warn(`Could not create collection ${name}:`, e.message || e);
                }
            }
        }

        // Helpful indexes
        try {
            await db.collection('orders').createIndex({ userEmail: 1 });
            await db.collection('orders').createIndex({ createdAt: -1 });
            await db.collection('payments').createIndex({ orderId: 1 });
            console.log('Ensured basic indexes');
        } catch (idxErr) {
            console.warn('Index creation warning:', idxErr.message || idxErr);
        }
        // Select database
        const database = db;
        // Temporary test route
        app.get('/', (req, res) => {
        res.render('message', {
            title: "Database Connected",
            message: "Hello, MongoDB is connected!",
            type: "info",
            redirectUrl: "/",
            buttonText: "Home"
        });
        });
        
        // Catch-all 404 handler (render dedicated 404 view)
        app.use((req, res) => {
            res.status(404).render('404', {
                title: 'Page Not Found',
                message: 'The page you requested could not be found.'
            });
        });

        // Error handler (500)
        // In development (NODE_ENV !== 'production') or when SHOW_STACK=true we render stack traces in-browser
        app.use((err, req, res, next) => {
            // Log detailed error info to terminal including request context
            const time = new Date().toISOString();
            console.error(`\n========== ERROR at ${time} ==========`);
            console.error(`Request: ${req.method} ${req.originalUrl}`);
            console.error(`Params:`, req.params || {});
            console.error(`Query:`, req.query || {});
            
            // Redact sensitive fields from body for logging
            const redactBody = (b) => {
                if (!b) return b;
                const copy = Object.assign({}, b);
                ['password', 'passwordHash', 'confirmPassword'].forEach(k => { if (copy[k]) copy[k] = '<<REDACTED>>'; });
                return copy;
            };
            console.error(`Body:`, redactBody(req.body));
            console.error(`Error Message:`, err && (err.message || err));
            console.error(`Error Stack:`);
            console.error(err && (err.stack || err));
            console.error(`==========================================\n`);

            if (res.headersSent) return next(err);

            const showStack = (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') || process.env.SHOW_STACK === 'true';

            if (showStack) {
                // Minimal HTML error page with stack (development only)
                res.status(500).send(`<!doctype html><html><head><meta charset="utf-8"><title>Server Error</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;sans-serif;padding:24px}pre{background:#111;color:#fff;padding:16px;border-radius:8px;overflow:auto}</style></head><body><h1>Server Error</h1><p>An unexpected error occurred (development mode). See stack trace below:</p><pre>${(err && err.stack) ? err.stack.replace(/</g, '&lt;') : String(err)}</pre></body></html>`);
            } else {
                res.status(500).render('500', {
                    title: 'Server Error',
                    message: 'An unexpected error occurred. Please try again later.'
                });
            }
        });
        // Start server
        app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("MongoDB connection failed", err);
    }
}

main();