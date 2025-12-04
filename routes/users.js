// routes/users.js
const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const { ObjectId } = require('mongodb');
require('dotenv').config();

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// MongoDB Client (use only one)
const client = new (require('mongodb').MongoClient)(process.env.MONGO_URI);
const dbName = "ecommerceDB";

// Ensure MongoDB connection on server start
async function getDB() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db(dbName);
}

/* -------------------------------------------
   SHOW REGISTER FORM
------------------------------------------- */
router.get('/register', (req, res) => {
    res.render('register', { title: "Register" });
});

/* -------------------------------------------
   REGISTRATION
------------------------------------------- */
router.post('/register', async (req, res) => {
    try {
        const db = await getDB();
        const usersCollection = db.collection('users');

        // Check duplicate email
        const existingUser = await usersCollection.findOne({ email: req.body.email });
        if (existingUser) return res.send("User already exists with this email.");

        // Hash password
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

        // Verification token
        const token = uuidv4();

        // Create user object
        const newUser = {
            userId: uuidv4(),
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            passwordHash: hashedPassword,
            role: "customer",
            accountStatus: "active",
            isEmailVerified: false,
            verificationToken: token,
            tokenExpiry: new Date(Date.now() + 3600 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await usersCollection.insertOne(newUser);

        // Build verification URL
        const verificationUrl = `${baseUrl}/users/verify/${token}`;

        // Send email
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: newUser.email,
            subject: "Verify your account",
            html: `
                <h2>Welcome, ${newUser.firstName}!</h2>
                <p>Please verify your email:</p>
                <a href="${verificationUrl}">${verificationUrl}</a>
            `
        });

        return res.send("Registration successful! Please check your email to verify your account.");

    } catch (err) {
        console.error("Error during registration:", err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   EMAIL VERIFICATION
------------------------------------------- */
router.get('/verify/:token', async (req, res) => {
    try {
        const db = await getDB();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ verificationToken: req.params.token });

        //  INVALID TOKEN UI
        if (!user) {
            return res.send(`
                <div style="
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: #f5f5f5;
                ">
                    <div style="
                        background: white;
                        padding: 40px;
                        max-width: 420px;
                        width: 100%;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        text-align: center;
                    ">
                        <h1 style="color: #e74c3c; margin-bottom: 10px;">✖ Invalid Link</h1>
                        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
                            This verification link is invalid or has already been used.
                        </p>

                        <a href="/users/register" style="
                            display: inline-block;
                            padding: 12px 25px;
                            background-color: #3498db;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            font-size: 16px;
                        ">Register Again</a>
                    </div>
                </div>
            `);
        }

        // EXPIRED TOKEN UI
        if (user.tokenExpiry < new Date()) {
            return res.send(`
                <div style="
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: #f5f5f5;
                ">
                    <div style="
                        background: white;
                        padding: 40px;
                        max-width: 420px;
                        width: 100%;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        text-align: center;
                    ">
                        <h1 style="color: #f39c12; margin-bottom: 10px;">⚠ Link Expired</h1>
                        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
                            Your verification link has expired. Please register again to receive a new one.
                        </p>

                        <a href="/users/register" style="
                            display: inline-block;
                            padding: 12px 25px;
                            background-color: #3498db;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            font-size: 16px;
                        ">Register Again</a>
                    </div>
                </div>
            `);
        }

        // ✔ SUCCESS – VERIFIED
        await usersCollection.updateOne(
            { verificationToken: req.params.token },
            { $set: { isEmailVerified: true }, $unset: { verificationToken: "", tokenExpiry: "" } }
        );

        return res.render('message', {
            title: "Registration Successful",
            message: `Please check your email to verify your account.`,
            type: "success", // optional: can be 'success', 'error', 'info'
            redirectUrl: "/users/login", // optional button to go to login
            buttonText: "Go to Login"
        });

    } catch (err) {
        console.error("Verification error:", err);
        res.send("Something went wrong.");
    }
});


/* -------------------------------------------
   SHOW ALL USERS
------------------------------------------- */
router.get('/list', async (req, res) => {
    try {
        const db = await getDB();
        const users = await db.collection('users').find().toArray();

        res.render('users-list', { title: "Registered Users", users });
    } catch (err) {
        console.error(err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   EDIT USER FORM
------------------------------------------- */
router.get('/edit/:id', async (req, res) => {
    try {
        const db = await getDB();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

        if (!user) return res.send("User not found.");

        res.render('edit-user', { title: "Edit User", user });
    } catch (err) {
        console.error(err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   SAVE EDITED USER
------------------------------------------- */
router.post('/edit/:id', async (req, res) => {
    try {
        const db = await getDB();
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            {
                $set: {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    email: req.body.email,
                    updatedAt: new Date()
                }
            }
        );

        res.redirect('/users/list');
    } catch (err) {
        console.error(err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   DELETE USER
------------------------------------------- */
router.post('/delete/:id', async (req, res) => {
    try {
        const db = await getDB();
        await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
        res.redirect('/users/list');
    } catch (err) {
        console.error(err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   LOGIN
------------------------------------------- */
router.get('/login', (req, res) => {
    res.render('login', { title: "Login", message: req.query.message });
});

router.post('/login', async (req, res) => {
    try {
        const db = await getDB();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ email: req.body.email });
        if (!user) return res.send("User not found.");

        if (user.accountStatus !== "active") return res.send("Account is not active.");
        if (!user.isEmailVerified) return res.send("Please verify your email first.");

        const valid = await bcrypt.compare(req.body.password, user.passwordHash);

        if (!valid) return res.send("Invalid password.");

        req.session.user = {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        };

        res.redirect('/users/dashboard');

    } catch (err) {
        console.error("Login error:", err);
        res.send("Something went wrong.");
    }
});

/* -------------------------------------------
   DASHBOARD
------------------------------------------- */
router.get('/dashboard', (req, res) => {
    if (!req.session.user)
        return res.redirect('/users/login?message=' + encodeURIComponent("Session expired. Please log in again."));
    res.render('dashboard', { title: "User Dashboard", user: req.session.user });
});

/* -------------------------------------------
   LOGOUT
------------------------------------------- */
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/users/login?message=' + encodeURIComponent("Logged out successfully."));
    });
});

/* -------------------------------------------
   ADMIN PAGE
------------------------------------------- */
router.get('/admin', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("Access denied.");
    }

    const db = await getDB();
    const users = await db.collection('users').find().toArray();

    res.render('admin', {
        title: "Admin Dashboard",
        users,
        currentUser: req.session.user
    });
});

module.exports = router;
