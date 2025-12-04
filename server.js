// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session'); //For user sessions
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        // Select database
        const database = client.db("ecommerceDB");
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

        // Error handler (500) — renders a dedicated 500 view for server errors
        app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);
            if (res.headersSent) return next(err);
            res.status(500).render('500', {
                title: 'Server Error',
                message: 'An unexpected error occurred. Please try again later.'
            });
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