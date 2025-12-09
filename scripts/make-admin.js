// scripts/make-admin.js
// Usage: node scripts/make-admin.js email@example.com

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function makeAdmin(email) {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || 'ecommerceDB');
        const usersCollection = db.collection('users');
        
        // Update user role to admin
        const result = await usersCollection.updateOne(
            { email: email },
            { $set: { role: 'admin' } }
        );
        
        if (result.matchedCount === 0) {
            console.log(`❌ User with email "${email}" not found.`);
            process.exit(1);
        }
        
        if (result.modifiedCount === 1) {
            console.log(`✅ Successfully updated ${email} to admin role!`);
            process.exit(0);
        } else {
            console.log(`⚠️ User was already an admin or update failed.`);
            process.exit(1);
        }
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

const email = process.argv[2];
if (!email) {
    console.log('Usage: node scripts/make-admin.js your-email@example.com');
    process.exit(1);
}

makeAdmin(email);
