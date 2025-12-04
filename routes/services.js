const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// List available services and booking form
router.get('/book', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to book a service.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        // Try to load services from DB, otherwise fallback to hard-coded catalog
        const servicesFromDb = await db.collection('services').find().toArray();

        const defaultServices = [
            { id: 'wash-fold', name: 'Wash & Fold', price: 180 },
            { id: 'dry-clean', name: 'Dry Clean', price: 250 },
            { id: 'ironing', name: 'Ironing', price: 120 }
        ];

        const services = (servicesFromDb && servicesFromDb.length > 0) ? servicesFromDb : defaultServices;

        res.render('services', { title: 'Book Service', services, user: req.session.user });
    } catch (err) {
        console.error('Services load error:', err);
        res.render('message', { title: 'Error', message: 'Could not load services.', type: 'error', redirectUrl: '/users/dashboard', buttonText: 'Back' });
    }
});

// Submit booking
router.post('/book', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login?message=' + encodeURIComponent('Please log in to book a service.'));

    try {
        const client = req.app.locals.client;
        const dbName = req.app.locals.dbName || 'ecommerceDB';
        const db = client.db(dbName);

        const serviceId = req.body.serviceId;
        const serviceName = req.body.serviceName;
        const pickupDate = req.body.pickupDate;
        const notes = req.body.notes || '';
        const price = Number(req.body.price) || 0;

        const order = {
            userEmail: req.session.user.email,
            userId: req.session.user.userId,
            serviceId,
            serviceName,
            pickupDate: pickupDate ? new Date(pickupDate) : null,
            notes,
            price,
            status: 'pending',
            paymentStatus: 'unpaid',
            createdAt: new Date()
        };

        const result = await db.collection('orders').insertOne(order);

        return res.render('message', {
            title: 'Booking Confirmed',
            message: `Your booking for ${serviceName} has been created. Order ID: ${result.insertedId}`,
            type: 'success',
            redirectUrl: '/orders/my',
            buttonText: 'View My Orders'
        });

    } catch (err) {
        console.error('Booking error:', err);
        return res.render('message', {
            title: 'Booking Failed',
            message: 'Could not create booking. Please try again.',
            type: 'error',
            redirectUrl: '/users/dashboard',
            buttonText: 'Back to Dashboard'
        });
    }
});

module.exports = router;
