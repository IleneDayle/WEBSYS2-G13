const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// View billing overview
router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to view billing.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const payments = await db.collection('payments').find({ userEmail: req.session.user.email }).sort({ createdAt: -1 }).toArray();
        const orders = await db.collection('orders').find({ userEmail: req.session.user.email }).sort({ createdAt: -1 }).toArray();

        res.render('billing', { title: 'Billing & Payments', payments, orders, user: req.session.user });
    } catch (err) {
        console.error('Billing error:', err);
        res.render('message', { title: 'Error', message: 'Could not load billing information.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
});

// Simulate payment for an order
router.post('/pay/:orderId', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to make a payment.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.orderId) });
        if (!order) return res.render('message', { title: 'Not Found', message: 'Order not found.', type: 'error', redirectUrl: '/billing', buttonText: 'Back' });

        if (order.userEmail !== req.session.user.email && req.session.user.role !== 'admin') {
            return res.status(403).render('message', { title: 'Access Denied', message: 'Not authorized.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
        }

        // Create a payment record
        const payment = {
            orderId: order._id,
            userEmail: req.session.user.email,
            amount: order.price || 0,
            method: req.body.method || 'card',
            status: 'completed',
            createdAt: new Date()
        };

        await db.collection('payments').insertOne(payment);
        await db.collection('orders').updateOne({ _id: order._id }, { $set: { paymentStatus: 'paid', status: 'processing', updatedAt: new Date() } });

        res.render('message', { title: 'Payment Success', message: 'Payment processed successfully.', type: 'success', redirectUrl: '/billing', buttonText: 'Back to Billing' });

    } catch (err) {
        console.error('Payment error:', err);
        res.render('message', { title: 'Error', message: 'Could not process payment.', type: 'error', redirectUrl: '/billing', buttonText: 'Back' });
    }
});

module.exports = router;
