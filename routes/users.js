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
        if (existingUser) return res.render('message', {
            title: "User Exists",
            message: "User already exists with this email.",
            type: "error",
            redirectUrl: "/users/register",
            buttonText: "Register"
        });

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

        try {
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

            return res.render('message', {
                title: "Registration Successful",
                message: "Registration successful! Please check your email to verify your account.",
                type: "success",
                redirectUrl: "/users/login",
                buttonText: "Go to Login"
            });
        } catch (emailErr) {
            console.error("Failed to send verification email:", emailErr);
            return res.render('message', {
                title: "Registration Created",
                message: "Registration successful, but failed to send verification email. Please contact support.",
                type: "info",
                redirectUrl: "/",
                buttonText: "Home"
            });
        }

    } catch (err) {
        console.error("Error during registration:", err);
        res.render('message', {
            title: "Registration Error",
            message: "Something went wrong during registration.",
            type: "error",
            redirectUrl: "/users/register",
            buttonText: "Try Again"
        });
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
            return res.render('message', {
                title: "Invalid Link",
                message: "This verification link is invalid or has already been used.",
                type: "error",
                redirectUrl: "/users/register",
                buttonText: "Register"
            });
        }

        // EXPIRED TOKEN UI
        if (user.tokenExpiry < new Date()) {
            return res.render('message', {
                title: "Link Expired",
                message: "Your verification link has expired. Please register again to receive a new one.",
                type: "error",
                redirectUrl: "/users/register",
                buttonText: "Register"
            });
        }

        // ✔ SUCCESS – VERIFIED
        await usersCollection.updateOne(
            { verificationToken: req.params.token },
            { $set: { isEmailVerified: true }, $unset: { verificationToken: "", tokenExpiry: "" } }
        );

        return res.render('message', {
            title: "Registration Successful",
            message: `Your account has been verified successfully!`,
            type: "success",
            redirectUrl: "/users/login",
            buttonText: "Go to Login"
        });

    } catch (err) {
        console.error("Verification error:", err);
        res.render('message', {
            title: "Verification Error",
            message: "Something went wrong during verification.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
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
        res.render('message', {
            title: "Error",
            message: "Something went wrong.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
    }
});

/* -------------------------------------------
   EDIT USER FORM
------------------------------------------- */
router.get('/edit/:id', async (req, res) => {
    try {
        const db = await getDB();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

        if (!user) return res.render('message', {
            title: "User Not Found",
            message: "User not found.",
            type: "error",
            redirectUrl: "/users/list",
            buttonText: "Back"
        });

        res.render('edit-user', { title: "Edit User", user });
    } catch (err) {
        console.error(err);
        res.render('message', {
            title: "Error",
            message: "Something went wrong.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
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
        res.render('message', {
            title: "Error",
            message: "Something went wrong.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
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
        res.render('message', {
            title: "Error",
            message: "Something went wrong.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
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
        if (!user) return res.render('message', {
            title: "Login Failed",
            message: "User not found.",
            type: "error",
            redirectUrl: "/users/login",
            buttonText: "Back to Login"
        });

        if (user.accountStatus !== "active") return res.render('message', {
            title: "Account Inactive",
            message: "Account is not active.",
            type: "error",
            redirectUrl: "/users/login",
            buttonText: "Back to Login"
        });
        if (!user.isEmailVerified) return res.render('message', {
            title: "Email Not Verified",
            message: "Please verify your email first.",
            type: "error",
            redirectUrl: "/users/login",
            buttonText: "Back to Login"
        });

        const valid = await bcrypt.compare(req.body.password, user.passwordHash);

        if (!valid) return res.render('message', {
            title: "Login Failed",
            message: "Invalid password.",
            type: "error",
            redirectUrl: "/users/login",
            buttonText: "Back to Login"
        });

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
        res.render('message', {
            title: "Login Error",
            message: "Something went wrong.",
            type: "error",
            redirectUrl: "/users/login",
            buttonText: "Back to Login"
        });
    }
});

/* -------------------------------------------
   DASHBOARD
------------------------------------------- */
router.get('/dashboard', (req, res) => {
    if (!req.session.user)
        return res.redirect('/users/login?message=' + encodeURIComponent("Session expired. Please log in again."));
    
    // For customer dashboard, render simple welcome page
    // Users can view their actual orders on the /orders/my page
    res.render('dashboard', { 
        title: "User Dashboard", 
        user: req.session.user,
        stats: {
            totalOrders: 0,
            activeOrders: 0,
            totalSpent: 0
        }
    });
});

/* -------------------------------------------
   PROFILE EDIT (self)
------------------------------------------- */
router.get('/profile/edit', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to edit your profile.'));

    try {
        const db = await getDB();
        const user = await db.collection('users').findOne({ email: req.session.user.email });
        if (!user) return res.render('message', { title: 'User Not Found', message: 'User not found.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });

        res.render('profile-edit', { title: 'Edit Profile', user });
    } catch (err) {
        console.error('Profile load error:', err);
        res.render('message', { title: 'Error', message: 'Could not load profile.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
});

router.post('/profile/edit', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to edit your profile.'));

    try {
        const db = await getDB();
        await db.collection('users').updateOne({ email: req.session.user.email }, { $set: {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            updatedAt: new Date()
        }});

        // Update session info
        req.session.user.firstName = req.body.firstName;
        req.session.user.lastName = req.body.lastName;
        req.session.user.email = req.body.email;

        res.render('message', { title: 'Profile Updated', message: 'Your profile has been updated.', type: 'success', redirectUrl: '/users/dashboard', buttonText: 'Back to Dashboard' });
    } catch (err) {
        console.error('Profile save error:', err);
        res.render('message', { title: 'Error', message: 'Could not save profile.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
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
        return res.status(403).render('message', {
            title: "Access Denied",
            message: "Access denied.",
            type: "error",
            redirectUrl: "/",
            buttonText: "Home"
        });
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
