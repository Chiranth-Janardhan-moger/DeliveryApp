require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabaseSize() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Get database stats
    const dbStats = await db.stats();
    
    console.log('📊 DATABASE STATISTICS');
    console.log('='.repeat(50));
    console.log(`Database Name: ${dbStats.db}`);
    console.log(`Collections: ${dbStats.collections}`);
    console.log(`Data Size: ${formatBytes(dbStats.dataSize)}`);
    console.log(`Storage Size: ${formatBytes(dbStats.storageSize)}`);
    console.log(`Index Size: ${formatBytes(dbStats.indexSize)}`);
    console.log(`Total Size: ${formatBytes(dbStats.dataSize + dbStats.indexSize)}`);
    console.log(`Average Object Size: ${formatBytes(dbStats.avgObjSize)}`);
    console.log('='.repeat(50));
    console.log();

    // Get collection stats
    const collections = await db.listCollections().toArray();
    const collectionStats = [];
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).stats();
      collectionStats.push({
        name: collection.name,
        count: stats.count,
        size: stats.size,
        storageSize: stats.storageSize,
        avgObjSize: stats.avgObjSize || 0,
        indexes: stats.nindexes,
        totalIndexSize: stats.totalIndexSize
      });
    }
    
    // Sort by size
    collectionStats.sort((a, b) => b.size - a.size);
    
    console.log('📦 COLLECTION DETAILS');
    console.log('='.repeat(50));
    collectionStats.forEach(col => {
      console.log(`\n${col.name}:`);
      console.log(`  Documents: ${col.count.toLocaleString()}`);
      console.log(`  Data Size: ${formatBytes(col.size)}`);
      console.log(`  Storage Size: ${formatBytes(col.storageSize)}`);
      console.log(`  Avg Doc Size: ${formatBytes(col.avgObjSize)}`);
      console.log(`  Indexes: ${col.indexes} (${formatBytes(col.totalIndexSize)})`);
    });
    console.log('='.repeat(50));

    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

checkDatabaseSize();
