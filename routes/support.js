const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Support form and ticket list
router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to contact support.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const tickets = await db.collection('supportTickets').find({ userEmail: req.session.user.email }).sort({ createdAt: -1 }).toArray();

        res.render('support', { title: 'Contact Support', tickets, user: req.session.user });
    } catch (err) {
        console.error('Support fetch error:', err);
        res.render('message', { title: 'Error', message: 'Could not load support tickets.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
});

// Submit ticket
router.post('/ticket', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to contact support.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const ticket = {
            userEmail: req.session.user.email,
            subject: req.body.subject || 'Support Request',
            message: req.body.message || '',
            status: 'open',
            createdAt: new Date()
        };

        await db.collection('supportTickets').insertOne(ticket);

        res.render('message', { title: 'Ticket Submitted', message: 'Your support ticket has been created.', type: 'success', redirectUrl: '/support', buttonText: 'Back to Support' });
    } catch (err) {
        console.error('Support submit error:', err);
        res.render('message', { title: 'Error', message: 'Could not submit ticket.', type: 'error', redirectUrl: '/support', buttonText: 'Back' });
    }
});

module.exports = router;
