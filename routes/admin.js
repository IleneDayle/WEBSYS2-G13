const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Admin dashboard sub-pages (orders/payments/support/services)
router.get('/', async (req, res) => {
    // Keep existing admin guard in users.js that links to /users/admin
    res.redirect('/users/admin');
});

router.get('/orders', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const orders = await db.collection('orders').find().sort({ createdAt: -1 }).toArray();
        res.render('admin-orders', { title: 'Manage Orders', orders, currentUser: req.session.user });
    } catch (err) {
        console.error('Admin orders error:', err);
        res.render('message', { title: 'Error', message: 'Could not load orders.', type: 'error', redirectUrl: '/users/admin', buttonText: 'Back' });
    }
});

router.get('/payments', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const payments = await db.collection('payments').find().sort({ createdAt: -1 }).toArray();
        res.render('admin-payments', { title: 'Payments', payments, currentUser: req.session.user });
    } catch (err) {
        console.error('Admin payments error:', err);
        res.render('message', { title: 'Error', message: 'Could not load payments.', type: 'error', redirectUrl: '/users/admin', buttonText: 'Back' });
    }
});

router.get('/support', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const tickets = await db.collection('supportTickets').find().sort({ createdAt: -1 }).toArray();
        res.render('admin-support', { title: 'Support Tickets', tickets, currentUser: req.session.user });
    } catch (err) {
        console.error('Admin support error:', err);
        res.render('message', { title: 'Error', message: 'Could not load support tickets.', type: 'error', redirectUrl: '/users/admin', buttonText: 'Back' });
    }
});

router.get('/services', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    // For now services are static; show a basic management page
    const services = [
        { id: 'wash-fold', name: 'Wash & Fold', price: 180 },
        { id: 'dry-clean', name: 'Dry Clean', price: 250 },
        { id: 'ironing', name: 'Ironing', price: 120 }
    ];

    res.render('admin-services', { title: 'Manage Services', services, currentUser: req.session.user });
});

router.get('/reports', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        
        // Get all orders with user info
        const orders = await db.collection('orders').find().sort({ createdAt: -1 }).toArray();
        const users = await db.collection('users').find().toArray();
        
        // Calculate sales metrics
        let totalRevenue = 0;
        let totalOrders = 0;
        let completedOrders = 0;
        let pendingOrders = 0;
        let cancelledOrders = 0;
        const salesByService = {};
        const salesByUser = {};
        
        orders.forEach(order => {
            totalOrders++;
            const amount = Number(order.price) || 0;
            totalRevenue += amount;
            
            // Count by status
            if (order.status === 'completed') completedOrders++;
            if (order.status === 'pending') pendingOrders++;
            if (order.status === 'cancelled') cancelledOrders++;
            
            // Sales by service
            const service = order.serviceName || 'Unknown';
            if (!salesByService[service]) {
                salesByService[service] = { count: 0, revenue: 0 };
            }
            salesByService[service].count++;
            salesByService[service].revenue += amount;
            
            // Sales by user
            const userEmail = order.userEmail || 'Unknown';
            if (!salesByUser[userEmail]) {
                salesByUser[userEmail] = { count: 0, revenue: 0, userName: '' };
                const user = users.find(u => u.email === userEmail);
                if (user) {
                    salesByUser[userEmail].userName = `${user.firstName} ${user.lastName}`;
                }
            }
            salesByUser[userEmail].count++;
            salesByUser[userEmail].revenue += amount;
        });
        
        const reportsData = {
            totalRevenue,
            totalOrders,
            completedOrders,
            pendingOrders,
            cancelledOrders,
            avgOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0,
            salesByService,
            salesByUser
        };
        
        res.render('admin-reports', { title: 'Sales Reports', reportsData, currentUser: req.session.user });
    } catch (err) {
        console.error('Admin reports error:', err);
        res.render('message', { title: 'Error', message: 'Could not load reports.', type: 'error', redirectUrl: '/users/admin', buttonText: 'Back' });
    }
});

/* -------------------------------------------
   ADMIN ACTIONS: Orders / Payments / Support / Services
------------------------------------------- */

// Change order status (generic)
router.post('/orders/:id/status', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    const status = req.body.status;
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        await db.collection('orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status, updatedAt: new Date() } });
        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Admin change status error:', err);
        res.render('message', { title: 'Error', message: 'Could not update order status.', type: 'error', redirectUrl: '/admin/orders', buttonText: 'Back' });
    }
});

// Mark order complete
router.post('/orders/:id/complete', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        await db.collection('orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: 'completed', updatedAt: new Date() } });
        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Admin complete error:', err);
        res.render('message', { title: 'Error', message: 'Could not mark order completed.', type: 'error', redirectUrl: '/admin/orders', buttonText: 'Back' });
    }
});

// Refund payment for an order (creates a refund record in payments with negative amount)
router.post('/orders/:id/refund', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.render('message', { title: 'Not Found', message: 'Order not found.', type: 'error', redirectUrl: '/admin/orders', buttonText: 'Back' });

        const refundAmount = Number(req.body.amount) || order.price || 0;

        const refund = {
            orderId: order._id,
            userEmail: order.userEmail,
            amount: -Math.abs(refundAmount),
            method: 'refund',
            status: 'refunded',
            createdAt: new Date(),
            refundedBy: req.session.user.email
        };

        await db.collection('payments').insertOne(refund);
        await db.collection('orders').updateOne({ _id: order._id }, { $set: { paymentStatus: 'refunded', status: 'refunded', updatedAt: new Date() } });

        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Admin refund error:', err);
        res.render('message', { title: 'Error', message: 'Could not process refund.', type: 'error', redirectUrl: '/admin/orders', buttonText: 'Back' });
    }
});

// Admin respond to support ticket
router.post('/support/respond/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const response = {
            responder: req.session.user.email,
            message: req.body.response || '',
            createdAt: new Date()
        };

        await db.collection('supportTickets').updateOne({ _id: new ObjectId(req.params.id) }, { $push: { responses: response }, $set: { status: 'responded', updatedAt: new Date() } });

        res.redirect('/admin/support');
    } catch (err) {
        console.error('Admin respond error:', err);
        res.render('message', { title: 'Error', message: 'Could not send response.', type: 'error', redirectUrl: '/admin/support', buttonText: 'Back' });
    }
});

// Manage services: update (upsert) and delete
router.post('/services/update/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const svc = { id: req.params.id, name: req.body.name, price: Number(req.body.price) };
        await db.collection('services').updateOne({ id: svc.id }, { $set: svc }, { upsert: true });
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Admin services update error:', err);
        res.render('message', { title: 'Error', message: 'Could not update service.', type: 'error', redirectUrl: '/admin/services', buttonText: 'Back' });
    }
});

router.post('/services/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        await db.collection('services').deleteOne({ id: req.params.id });
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Admin services delete error:', err);
        res.render('message', { title: 'Error', message: 'Could not delete service.', type: 'error', redirectUrl: '/admin/services', buttonText: 'Back' });
    }
});

// PRODUCTS MANAGEMENT
router.get('/manage-services', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const q = (req.query.q || '').trim();
        let filter = {};
        if (q) {
            filter = { $or: [ { name: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } } ] };
        }
        const services = await db.collection('services').find(filter).sort({ createdAt: -1 }).toArray();
        res.render('admin-manage-services', { title: 'Manage Services', services, currentUser: req.session.user, q });
    } catch (err) {
        console.error('Admin services error:', err);
        res.render('message', { title: 'Error', message: 'Could not load services.', type: 'error', redirectUrl: '/users/admin', buttonText: 'Back' });
    }
});

router.get('/manage-services/new', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    res.render('admin-service-form', { title: 'Add New Service', service: null, currentUser: req.session.user });
});

router.get('/manage-services/edit/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const service = await db.collection('services').findOne({ _id: new ObjectId(req.params.id) });
        if (!service) return res.render('message', { title: 'Not Found', message: 'Service not found.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });

        res.render('admin-service-form', { title: 'Edit Service', service, currentUser: req.session.user });
    } catch (err) {
        console.error('Admin service edit error:', err);
        res.render('message', { title: 'Error', message: 'Could not load service.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
    }
});

router.post('/manage-services/save', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const { serviceId, name, description, price } = req.body;

        const serviceData = {
            name: name,
            description: description,
            price: parseFloat(price),
            updatedAt: new Date()
        };

        if (serviceId && serviceId !== '') {
            // Update existing service
            // Prevent duplicate names: check if another service (different _id) has same name (case-insensitive)
            const dup = await db.collection('services').findOne({ name: { $regex: `^${name}$`, $options: 'i' }, _id: { $ne: new ObjectId(serviceId) } });
            if (dup) {
                return res.render('message', { title: 'Duplicate Service', message: 'A service with that name already exists. Please choose a different name.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
            }

            await db.collection('services').updateOne(
                { _id: new ObjectId(serviceId) },
                { $set: serviceData }
            );

            res.redirect('/admin/manage-services?success=Service updated successfully');
        } else {
            // Create new service
            serviceData.createdAt = new Date();
            // Prevent duplicate names when creating
            const dup = await db.collection('services').findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
            if (dup) {
                return res.render('message', { title: 'Duplicate Service', message: 'A service with that name already exists. Please choose a different name.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
            }

            await db.collection('services').insertOne(serviceData);
            res.redirect('/admin/manage-services?success=Service created successfully');
        }
    } catch (err) {
        console.error('Admin service save error:', err);
        res.render('message', { title: 'Error', message: 'Could not save service.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
    }
});

router.post('/manage-services/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const svcId = req.params.id;
        const service = await db.collection('services').findOne({ _id: new ObjectId(svcId) });
        if (!service) return res.render('message', { title: 'Not Found', message: 'Service not found.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });

        // Check for any orders that reference this service (any status).
        const queryVariants = [
            { serviceId: new ObjectId(svcId) },
            { serviceId: svcId },
            { serviceId: service.id },
            { serviceName: service.name }
        ].filter(Boolean);

        const referencingOrders = await db.collection('orders').countDocuments({ $or: queryVariants });
        if (referencingOrders > 0) {
            return res.render('message', { title: 'Cannot Delete', message: 'This service cannot be deleted because customers have bookings associated with it.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
        }

        // Safe to delete
        await db.collection('services').deleteOne({ _id: new ObjectId(svcId) });
        res.redirect('/admin/manage-services?success=Service deleted successfully');
    } catch (err) {
        console.error('Admin service delete error:', err);
        res.render('message', { title: 'Error', message: 'Could not delete service.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
    }
});

module.exports = router;
