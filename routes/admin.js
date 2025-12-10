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
        
        // Get filter params from query string
        const filterStatus = (req.query.status || '').trim();
        const filterService = (req.query.service || '').trim();
        const filterDateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
        const filterDateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

        // Build filter for orders
        let ordersFilter = {};
        if (filterStatus) {
            ordersFilter.status = filterStatus;
        }
        if (filterService) {
            ordersFilter.serviceName = { $regex: filterService, $options: 'i' };
        }
        if (filterDateFrom || filterDateTo) {
            ordersFilter.createdAt = {};
            if (filterDateFrom) ordersFilter.createdAt.$gte = filterDateFrom;
            if (filterDateTo) {
                const endOfDay = new Date(filterDateTo);
                endOfDay.setHours(23, 59, 59, 999);
                ordersFilter.createdAt.$lte = endOfDay;
            }
        }

        // Get filtered orders with user info
        const orders = await db.collection('orders').find(ordersFilter).sort({ createdAt: -1 }).toArray();
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
        
        res.render('admin-reports', { 
            title: 'Sales Reports', 
            reportsData, 
            currentUser: req.session.user,
            filterStatus: filterStatus || '',
            filterService: filterService || '',
            filterDateFrom: req.query.dateFrom || '',
            filterDateTo: req.query.dateTo || ''
        });
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

            // Fetch updated services list and re-render with success message
            const services = await db.collection('services').find().sort({ createdAt: -1 }).toArray();
            return res.render('admin-manage-services', { title: 'Manage Services', services, currentUser: req.session.user, success: '✅ Service updated successfully!', q: '' });
        } else {
            // Create new service
            serviceData.createdAt = new Date();
            // Prevent duplicate names when creating
            const dup = await db.collection('services').findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
            if (dup) {
                return res.render('message', { title: 'Duplicate Service', message: 'A service with that name already exists. Please choose a different name.', type: 'error', redirectUrl: '/admin/manage-services', buttonText: 'Back' });
            }

            await db.collection('services').insertOne(serviceData);
            // Fetch updated services list and re-render with success message
            const services = await db.collection('services').find().sort({ createdAt: -1 }).toArray();
            return res.render('admin-manage-services', { title: 'Manage Services', services, currentUser: req.session.user, success: '✅ Service created successfully!', q: '' });
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

/* -------------------------------------------
   EXPORT REPORTS
------------------------------------------- */

// Helper function to calculate reports data
async function calculateReportsData(db, ordersFilter) {
    const orders = await db.collection('orders').find(ordersFilter).sort({ createdAt: -1 }).toArray();
    const users = await db.collection('users').find().toArray();
    
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
        
        if (order.status === 'completed') completedOrders++;
        if (order.status === 'pending') pendingOrders++;
        if (order.status === 'cancelled') cancelledOrders++;
        
        const service = order.serviceName || 'Unknown';
        if (!salesByService[service]) {
            salesByService[service] = { count: 0, revenue: 0 };
        }
        salesByService[service].count++;
        salesByService[service].revenue += amount;
        
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
    
    return {
        totalRevenue,
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        avgOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0,
        salesByService,
        salesByUser,
        orders
    };
}

// Export reports as Excel
router.get('/reports/export/excel', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access Denied');

    try {
        const ExcelJS = require('exceljs');
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        
        // Build filter
        let ordersFilter = {};
        if (req.query.status) ordersFilter.status = req.query.status;
        if (req.query.service) ordersFilter.serviceName = { $regex: req.query.service, $options: 'i' };
        if (req.query.dateFrom || req.query.dateTo) {
            ordersFilter.createdAt = {};
            if (req.query.dateFrom) ordersFilter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                const endOfDay = new Date(req.query.dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                ordersFilter.createdAt.$lte = endOfDay;
            }
        }
        
        const reportsData = await calculateReportsData(db, ordersFilter);
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 20 },
            { header: 'Value', key: 'value', width: 15 }
        ];
        summarySheet.addRows([
            { metric: 'Total Revenue', value: `₱${reportsData.totalRevenue}` },
            { metric: 'Total Orders', value: reportsData.totalOrders },
            { metric: 'Completed Orders', value: reportsData.completedOrders },
            { metric: 'Pending Orders', value: reportsData.pendingOrders },
            { metric: 'Cancelled Orders', value: reportsData.cancelledOrders },
            { metric: 'Average Order Value', value: `₱${reportsData.avgOrderValue}` }
        ]);
        
        // Sales by Service sheet
        const serviceSheet = workbook.addWorksheet('Sales by Service');
        serviceSheet.columns = [
            { header: 'Service', key: 'service', width: 25 },
            { header: 'Orders', key: 'orders', width: 12 },
            { header: 'Revenue', key: 'revenue', width: 15 }
        ];
        const serviceRows = Object.entries(reportsData.salesByService).map(([service, data]) => ({
            service,
            orders: data.count,
            revenue: `₱${data.revenue}`
        }));
        serviceSheet.addRows(serviceRows);
        
        // Sales by User sheet
        const userSheet = workbook.addWorksheet('Sales by User');
        userSheet.columns = [
            { header: 'Customer Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Orders', key: 'orders', width: 12 },
            { header: 'Revenue', key: 'revenue', width: 15 }
        ];
        const userRows = Object.entries(reportsData.salesByUser).map(([email, data]) => ({
            name: data.userName || email,
            email,
            orders: data.count,
            revenue: `₱${data.revenue}`
        }));
        userSheet.addRows(userRows);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Sales-Report.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).send('Could not generate Excel file');
    }
});

// Export reports as PDF
router.get('/reports/export/pdf', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access Denied');

    try {
        const PDFDocument = require('pdfkit');
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        
        // Build filter
        let ordersFilter = {};
        if (req.query.status) ordersFilter.status = req.query.status;
        if (req.query.service) ordersFilter.serviceName = { $regex: req.query.service, $options: 'i' };
        if (req.query.dateFrom || req.query.dateTo) {
            ordersFilter.createdAt = {};
            if (req.query.dateFrom) ordersFilter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                const endOfDay = new Date(req.query.dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                ordersFilter.createdAt.$lte = endOfDay;
            }
        }
        
        const reportsData = await calculateReportsData(db, ordersFilter);
        
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Sales-Report.pdf"');
        doc.pipe(res);
        
        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        
        // Summary metrics
        doc.fontSize(12).font('Helvetica-Bold').text('Summary');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Revenue: ₱${reportsData.totalRevenue}`);
        doc.text(`Total Orders: ${reportsData.totalOrders}`);
        doc.text(`Completed Orders: ${reportsData.completedOrders}`);
        doc.text(`Pending Orders: ${reportsData.pendingOrders}`);
        doc.text(`Cancelled Orders: ${reportsData.cancelledOrders}`);
        doc.text(`Average Order Value: ₱${reportsData.avgOrderValue}`);
        doc.moveDown();
        
        // Sales by Service - text and simple bar chart
        doc.fontSize(12).font('Helvetica-Bold').text('Sales by Service');
        doc.fontSize(9).font('Helvetica');

        const serviceEntries = Object.entries(reportsData.salesByService || {});
        if (serviceEntries.length === 0) {
            doc.text('No service sales data available.');
        } else {
            // Print textual list first
            serviceEntries.forEach(([service, data]) => {
                doc.text(`${service}: ${data.count} orders, ₱${data.revenue} revenue`);
            });

            doc.moveDown(0.5);
            // Draw a simple horizontal bar chart for service revenues
            const chartWidth = 450;
            const chartHeight = 140;
            const chartX = doc.x;
            const chartY = doc.y;

            // Compute max revenue for scaling
            const maxRevenue = Math.max(...serviceEntries.map(([_, d]) => d.revenue || 0));

            // Draw chart background box
            doc.save();
            doc.rect(chartX - 2, chartY - 2, chartWidth + 4, chartHeight + 24).stroke('#cccccc');

            const barAreaHeight = chartHeight - 20;
            const barGap = 6;
            const barCount = serviceEntries.length;
            const barWidth = Math.max(20, (chartWidth - (barGap * (barCount - 1))) / barCount);

            let bx = chartX;
            serviceEntries.forEach(([service, data]) => {
                const revenue = Number(data.revenue) || 0;
                const h = maxRevenue > 0 ? Math.round((revenue / maxRevenue) * barAreaHeight) : 0;

                // Draw bar
                const barTop = chartY + (barAreaHeight - h);
                doc.rect(bx, barTop, barWidth, h).fill('#4a90e2');

                // Service label (rotate small or wrap) - keep simple: abbreviated label
                const label = service.length > 18 ? service.slice(0, 15) + '...' : service;
                doc.fillColor('#000000').fontSize(8).text(label, bx, chartY + barAreaHeight + 4, { width: barWidth, align: 'center' });

                // revenue value above bar
                doc.fontSize(8).text(`₱${revenue}`, bx, barTop - 10, { width: barWidth, align: 'center' });

                bx += barWidth + barGap;
            });

            // X-axis label
            doc.restore();
            doc.moveDown((chartHeight / 100) + 0.5);
        }

        doc.moveDown();

        // Sales by User (Top customers)
        doc.fontSize(12).font('Helvetica-Bold').text('Top Customers');
        doc.fontSize(9).font('Helvetica');
        const topCustomers = Object.entries(reportsData.salesByUser || {}).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
        if (topCustomers.length === 0) {
            doc.text('No customer sales data available.');
        } else {
            topCustomers.forEach(([email, data]) => {
                doc.text(`${data.userName || email}: ${data.count} orders, ₱${data.revenue} revenue`);
            });
        }
        
        doc.end();
    } catch (err) {
        console.error('PDF export error:', err);
        res.status(500).send('Could not generate PDF file');
    }
});

// Daily sales report view
router.get('/reports/daily', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const dateParam = req.query.date || (new Date()).toISOString().slice(0,10); // YYYY-MM-DD
        const start = new Date(dateParam);
        start.setHours(0,0,0,0);
        const end = new Date(dateParam);
        end.setHours(23,59,59,999);

        const ordersFilter = { createdAt: { $gte: start, $lte: end } };
        const reportsData = await calculateReportsData(db, ordersFilter);

        res.render('admin-report-daily', {
            title: `Daily Report - ${dateParam}`,
            reportsData,
            reportDate: dateParam,
            currentUser: req.session.user
        });
    } catch (err) {
        console.error('Daily report error:', err);
        res.render('message', { title: 'Error', message: 'Could not load daily report.', type: 'error', redirectUrl: '/admin/reports', buttonText: 'Back' });
    }
});

// Overall sales report view (all time)
router.get('/reports/overall', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).render('message', { title: 'Access Denied', message: 'Access denied.', type: 'error', redirectUrl: '/', buttonText: 'Home' });

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');
        const reportsData = await calculateReportsData(db, {});

        res.render('admin-report-overall', {
            title: 'Overall Sales Report',
            reportsData,
            currentUser: req.session.user
        });
    } catch (err) {
        console.error('Overall report error:', err);
        res.render('message', { title: 'Error', message: 'Could not load overall report.', type: 'error', redirectUrl: '/admin/reports', buttonText: 'Back' });
    }
});

// CSV export alternative (orders list) - useful when Excel is not available on the client
router.get('/reports/export/csv', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access Denied');

    try {
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');

        // Build filter same as other exports
        let ordersFilter = {};
        if (req.query.status) ordersFilter.status = req.query.status;
        if (req.query.service) ordersFilter.serviceName = { $regex: req.query.service, $options: 'i' };
        if (req.query.dateFrom || req.query.dateTo) {
            ordersFilter.createdAt = {};
            if (req.query.dateFrom) ordersFilter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                const endOfDay = new Date(req.query.dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                ordersFilter.createdAt.$lte = endOfDay;
            }
        }

        const orders = await db.collection('orders').find(ordersFilter).sort({ createdAt: -1 }).toArray();

        // Build CSV content: Order ID, Date, User Email, Service, Status, Price
        const header = ['Order ID', 'Date', 'User Email', 'Service', 'Status', 'Price'];
        const rows = orders.map(o => {
            const dateStr = o.createdAt ? new Date(o.createdAt).toISOString() : '';
            const id = o._id ? (o._id.toString ? o._id.toString() : o._id) : '';
            const email = o.userEmail || '';
            const service = o.serviceName || '';
            const status = o.status || '';
            const price = o.price != null ? o.price : '';
            return [id, dateStr, email, service, status, price];
        });

        const escapeCell = v => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [header.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Sales-Report.csv"');
        res.send(csv);
    } catch (err) {
        console.error('CSV export error:', err);
        res.status(500).send('Could not generate CSV file');
    }
});

// Google Sheets export (creates a spreadsheet in a service-account-owned Drive)
router.get('/reports/export/sheets', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access Denied');

    try {
        const { google } = require('googleapis');
        const db = req.app.locals.client.db(req.app.locals.dbName || 'ecommerceDB');

        // Build filter same as other exports
        let ordersFilter = {};
        if (req.query.status) ordersFilter.status = req.query.status;
        if (req.query.service) ordersFilter.serviceName = { $regex: req.query.service, $options: 'i' };
        if (req.query.dateFrom || req.query.dateTo) {
            ordersFilter.createdAt = {};
            if (req.query.dateFrom) ordersFilter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                const endOfDay = new Date(req.query.dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                ordersFilter.createdAt.$lte = endOfDay;
            }
        }

        const reportsData = await calculateReportsData(db, ordersFilter);

        // Load service account credentials from env var (JSON) or file path
        let key;
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try { key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY); } catch (e) { /* fallthrough */ }
        }
        if (!key && process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
            key = require(process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
        }

        if (!key || !key.client_email || !key.private_key) {
            return res.status(400).send('Google service account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_FILE.');
        }

        const auth = new google.auth.JWT(key.client_email, null, key.private_key, [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]);

        await auth.authorize();
        const sheetsApi = google.sheets({ version: 'v4', auth });

        // Create a new spreadsheet with three sheets
        const title = `Sales Report - ${new Date().toISOString().slice(0,10)}`;
        const resource = {
            properties: { title },
            sheets: [
                { properties: { title: 'Summary' } },
                { properties: { title: 'Sales by Service' } },
                { properties: { title: 'Sales by User' } }
            ]
        };

        const createRes = await sheetsApi.spreadsheets.create({ resource });
        const spreadsheetId = createRes.data.spreadsheetId;
        const spreadsheetUrl = createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

        // Populate Summary
        const summaryValues = [
            ['Metric', 'Value'],
            ['Total Revenue', reportsData.totalRevenue],
            ['Total Orders', reportsData.totalOrders],
            ['Completed Orders', reportsData.completedOrders],
            ['Pending Orders', reportsData.pendingOrders],
            ['Cancelled Orders', reportsData.cancelledOrders],
            ['Average Order Value', reportsData.avgOrderValue]
        ];

        await sheetsApi.spreadsheets.values.update({
            spreadsheetId,
            range: 'Summary!A1',
            valueInputOption: 'RAW',
            requestBody: { values: summaryValues }
        });

        // Populate Sales by Service
        const serviceRows = [['Service', 'Orders', 'Revenue']].concat(Object.entries(reportsData.salesByService || {}).map(([service, d]) => [service, d.count, d.revenue]));
        await sheetsApi.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sales by Service!A1',
            valueInputOption: 'RAW',
            requestBody: { values: serviceRows }
        });

        // Populate Sales by User
        const userRows = [['Customer Name', 'Email', 'Orders', 'Revenue']].concat(Object.entries(reportsData.salesByUser || {}).map(([email, d]) => [d.userName || email, email, d.count, d.revenue]));
        await sheetsApi.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sales by User!A1',
            valueInputOption: 'RAW',
            requestBody: { values: userRows }
        });

        // Return the created spreadsheet URL so admin can open it
        res.redirect(spreadsheetUrl);
    } catch (err) {
        console.error('Google Sheets export error:', err);
        res.status(500).send('Could not create Google Sheet: ' + (err && err.message ? err.message : 'unknown'));
    }
});

module.exports = router;
