const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// View current user's orders
router.get('/my', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to view orders.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const orders = await db.collection('orders').find({ userEmail: req.session.user.email }).sort({ createdAt: -1 }).toArray();

        res.render('orders', { title: 'My Orders', orders, user: req.session.user });
    } catch (err) {
        console.error('Orders fetch error:', err);
        res.render('message', { title: 'Error', message: 'Could not load orders.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
});

// View specific order
router.get('/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to view orders.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.render('message', { title: 'Not Found', message: 'Order not found.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back to Orders' });

        // Security: ensure the user owns the order or is admin
        if (order.userEmail !== req.session.user.email && req.session.user.role !== 'admin') {
            return res.status(403).render('message', { title: 'Access Denied', message: 'Not authorized.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
        }

        res.render('order-details', { title: `Order ${req.params.id}`, order, user: req.session.user });
    } catch (err) {
        console.error('Order detail error:', err);
        res.render('message', { title: 'Error', message: 'Could not load order.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back to Orders' });
    }
});

// Cancel order (simple status update)
router.post('/cancel/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to modify orders.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.render('message', { title: 'Not Found', message: 'Order not found.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });

        if (order.userEmail !== req.session.user.email && req.session.user.role !== 'admin') {
            return res.status(403).render('message', { title: 'Access Denied', message: 'Not authorized.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
        }

        await db.collection('orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: 'cancelled', updatedAt: new Date() } });

        res.render('message', { title: 'Order Cancelled', message: 'Order has been cancelled.', type: 'success', redirectUrl: '/orders/my', buttonText: 'Back to Orders' });

    } catch (err) {
        console.error('Cancel error:', err);
        res.render('message', { title: 'Error', message: 'Could not cancel order.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });
    }
});

// Admin: Update order status
router.post('/:id/status', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login');
    if (req.session.user.role !== 'admin') {
        return res.status(403).render('message', { title: 'Access Denied', message: 'Only admins can update order status.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });
    }

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const validStatuses = ['pending', 'shipped', 'completed', 'cancelled'];
        const newStatus = req.body.status;

        if (!validStatuses.includes(newStatus)) {
            return res.render('message', { title: 'Invalid Status', message: 'Invalid status value.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });
        }

        const result = await db.collection('orders').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: newStatus, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.render('message', { title: 'Not Found', message: 'Order not found.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });
        }

        res.render('message', { 
            title: 'Status Updated', 
            message: `Order status updated to ${newStatus}.`, 
            type: 'success', 
            redirectUrl: `/orders/${req.params.id}`, 
            buttonText: 'View Order' 
        });

    } catch (err) {
        console.error('Status update error:', err);
        res.render('message', { title: 'Error', message: 'Could not update order status.', type: 'error', redirectUrl: '/orders/my', buttonText: 'Back' });
    }
});

module.exports = router;
