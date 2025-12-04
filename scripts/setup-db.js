// scripts/setup-db.js
// Creates required collections and seeds a small services catalog for a fresh DB.

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('Missing MONGO_URI in .env. Please set it and re-run.');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbName = process.env.DB_NAME || 'ecommerceDB';
        const db = client.db(dbName);
        console.log('Connected to', dbName);

        const requiredCollections = ['users', 'services', 'orders', 'payments', 'supportTickets'];
        const existing = await db.listCollections({}, { nameOnly: true }).toArray();
        const existingNames = existing.map(c => c.name);

        for (const name of requiredCollections) {
            if (!existingNames.includes(name)) {
                await db.createCollection(name);
                console.log('Created collection:', name);
            } else {
                console.log('Collection exists:', name);
            }
        }

        // Seed simple services if none exist
        const servicesCount = await db.collection('services').countDocuments();
        if (servicesCount === 0) {
            const seed = [
                { id: 'wash-fold', name: 'Wash & Fold', price: 180, description: 'Standard wash and fold service', createdAt: new Date() },
                { id: 'dry-clean', name: 'Dry Clean', price: 250, description: 'Dry cleaning for delicate garments', createdAt: new Date() },
                { id: 'ironing', name: 'Ironing', price: 120, description: 'Ironing and pressing service', createdAt: new Date() }
            ];
            await db.collection('services').insertMany(seed);
            console.log('Seeded services collection.');
        } else {
            console.log('Services collection already has', servicesCount, 'documents');
        }

        // Create helpful indexes
        await db.collection('orders').createIndex({ userEmail: 1 });
        await db.collection('orders').createIndex({ createdAt: -1 });
        await db.collection('payments').createIndex({ orderId: 1 });
        console.log('Ensured basic indexes.');

        console.log('Setup complete.');
    } catch (err) {
        console.error('Setup failed:', err);
    } finally {
        await client.close();
    }
}

main();
