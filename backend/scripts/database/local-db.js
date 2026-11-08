import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dbPath = path.join(root, '.local', 'mongodb');
const envPath = path.join(root, 'backend', '.env');
const serverUri = 'mongodb://127.0.0.1:27019';
const replicaSet = 'cinemaLocal';
const { serialize, EJSON } = mongoose.mongo.BSON;

async function connect(uri, timeout = 1500) {
  const connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: timeout, autoIndex: false, autoCreate: false });
  connection.on('error', () => {});
  try { return await connection.asPromise(); }
  catch (error) { await connection.close().catch(() => {}); throw error; }
}

async function findMongod(config) {
  const configured = process.env.MONGOD_BINARY || config.MONGOD_BINARY;
  if (configured) {
    if (!existsSync(configured)) throw new Error('MONGOD_BINARY must point to an existing mongod executable.');
    return configured;
  }
  try {
    if (process.platform === 'win32') return execFileSync('where.exe', ['mongod'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0];
    execFileSync('mongod', ['--version'], { stdio: 'ignore' });
    return 'mongod';
  } catch { /* MongoDB's Windows installer may not add mongod to PATH. */ }
  if (process.platform === 'win32') {
    const directory = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
    const versions = await readdir(directory).catch(() => []);
    versions.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    for (const version of versions) {
      const binary = path.join(directory, version, 'bin', 'mongod.exe');
      if (existsSync(binary)) return binary;
    }
  }
  throw new Error('Install MongoDB Community Server or set MONGOD_BINARY to mongod, then retry.');
}

async function startReplica(config) {
  await mkdir(dbPath, { recursive: true });
  let connection;
  try { connection = await connect(serverUri + '/admin?directConnection=true'); }
  catch {
    const binary = await findMongod(config);
    const child = spawn(binary, ['--replSet', replicaSet, '--port', '27019', '--bind_ip', '127.0.0.1',
      '--dbpath', dbPath, '--logpath', path.join(dbPath, 'mongo.log'), '--wiredTigerCacheSizeGB', '0.25'],
    { detached: true, windowsHide: true, stdio: 'ignore' });
    let launchError;
    child.on('error', error => { launchError = error; });
    child.unref();
    console.log('Starting local MongoDB replica set...');
    for (let attempt = 0; attempt < 20 && !connection && !launchError; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try { connection = await connect(serverUri + '/admin?directConnection=true', 800); }
      catch { /* Wait for the new mongod process. */ }
    }
    if (!connection) throw new Error('Cannot start MongoDB. Check MONGOD_BINARY, port 27019 and .local/mongodb/mongo.log.');
  }
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    if (hello.setName && hello.setName !== replicaSet) throw new Error('Port 27019 belongs to another replica set. No configuration was changed.');
    if (!hello.setName) {
      const options = await connection.db.admin().command({ getCmdLineOpts: 1 });
      const configuredSet = options.parsed.replication?.replSetName || options.parsed.replication?.replSet;
      if (configuredSet !== replicaSet || path.resolve(options.parsed.storage?.dbPath || '') !== dbPath) {
        throw new Error('Port 27019 is not this project\'s replica set. No existing database was reconfigured.');
      }
      try { await connection.db.admin().command({ replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host: '127.0.0.1:27019' }] } }); }
      catch (error) { if (error.code !== 23) throw error; }
    }
  } finally { await connection.close(); }
  const primary = await connect(serverUri + '/admin?replicaSet=' + replicaSet, 20000);
  await primary.close();
  console.log('Local replica set is ready on port 27019.');
}

function fingerprint(documents) {
  const hash = createHash('sha256');
  for (const document of documents) hash.update(serialize(document));
  return hash.digest('hex');
}

async function readDocuments(db, name) {
  return db.collection(name).find({}, { promoteValues: false }).sort({ _id: 1 }).toArray();
}

async function copyDatabase(source, target, backupDirectory) {
  const snapshots = [];
  let size = 0;
  const collections = await source.db.listCollections().toArray();
  for (const collection of collections) {
    if (collection.name.startsWith('system.') || collection.type !== 'collection' || collection.options?.timeseries) {
      throw new Error('Automatic import supports ordinary application collections only. Use MongoDB Database Tools for this database.');
    }
    const stats = await source.db.command({ collStats: collection.name });
    size += stats.size || 0;
    if (size > 50 * 1024 * 1024 || stats.count > 50000) {
      throw new Error('Local import supports up to 50 MB total / 50,000 documents per collection. Use mongodump/mongorestore for larger data.');
    }
    const documents = await readDocuments(source.db, collection.name);
    snapshots.push({ name: collection.name, options: collection.options || {}, documents,
      indexes: await source.db.collection(collection.name).indexes(), checksum: fingerprint(documents) });
  }
  await writeFile(path.join(backupDirectory, 'database.ejson'), EJSON.stringify({ database: source.name, collections: snapshots }, { relaxed: false }), { mode: 0o600 });
  console.log('Database backup saved locally. Checking source consistency...');
  const currentNames = (await source.db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name).sort();
  if (JSON.stringify(currentNames) !== JSON.stringify(snapshots.map(item => item.name).sort())) throw new Error('Source collections changed. Stop the backend and retry.');
  for (const snapshot of snapshots) {
    if (fingerprint(await readDocuments(source.db, snapshot.name)) !== snapshot.checksum) throw new Error('Source data changed. Stop the backend and retry.');
  }
  const existing = await target.db.listCollections({}, { nameOnly: true }).toArray();
  let populated = false;
  for (const collection of existing) {
    if (await target.db.collection(collection.name).countDocuments() > 0) populated = true;
  }
  if (populated) {
    // Reuse a completed identical import, but never overwrite different target data.
    if (JSON.stringify(existing.map(item => item.name).sort()) !== JSON.stringify(snapshots.map(item => item.name).sort())) throw new Error('Target has different collections. No data was overwritten; .env is unchanged.');
    for (const snapshot of snapshots) {
      if (fingerprint(await readDocuments(target.db, snapshot.name)) !== snapshot.checksum) throw new Error('Target has different data. No data was overwritten; .env is unchanged.');
    }
    console.log('Target already matches source; no duplicate records were inserted.');
  } else {
    for (const snapshot of snapshots) {
      if (!existing.some(item => item.name === snapshot.name)) await target.db.createCollection(snapshot.name, snapshot.options);
      const indexes = [];
      for (const index of snapshot.indexes) {
        if (index.name === '_id_') continue;
        const options = { ...index };
        delete options.v; delete options.ns;
        indexes.push(options);
      }
      if (indexes.length) await target.db.collection(snapshot.name).createIndexes(indexes);
    }
    const session = await target.startSession();
    try {
      await session.withTransaction(async () => {
        for (const snapshot of snapshots) {
          if (snapshot.documents.length) await target.db.collection(snapshot.name).insertMany(snapshot.documents, { session });
        }
      });
    } finally { await session.endSession(); }
  }
  for (const snapshot of snapshots) {
    if (fingerprint(await readDocuments(target.db, snapshot.name)) !== snapshot.checksum) throw new Error('Copy verification failed. Original database and .env are unchanged.');
    console.log('Verified ' + snapshot.name + ': ' + snapshot.documents.length + ' documents');
  }
}

async function configureEnvironment(content, config, envExists) {
  const sourceUrl = new URL(config.MONGODB_URI);
  if (sourceUrl.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname)) {
    throw new Error('Setup only imports local MongoDB. Remote/Atlas connections are not rewritten.');
  }
  const database = decodeURIComponent(sourceUrl.pathname.slice(1));
  if (!database || ['admin', 'config', 'local'].includes(database) || database.includes('/')) throw new Error('Configure an application database name in backend/.env first.');
  const targetUri = serverUri + '/' + encodeURIComponent(database) + '?replicaSet=' + replicaSet;
  const backupDirectory = path.join(root, '.local', 'backups', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
  await mkdir(backupDirectory, { recursive: true });
  if (envExists) await writeFile(path.join(backupDirectory, 'backend.env'), content, { mode: 0o600 });
  if ((sourceUrl.port || '27017') !== '27019') {
    console.log('Copying existing local data; the original database will not be changed.');
    const source = await connect(config.MONGODB_URI, 10000);
    let target;
    try { target = await connect(targetUri, 10000); await copyDatabase(source, target, backupDirectory); }
    finally { await source.close(); if (target) await target.close(); }
  }
  // Change .env only after all collections and their checksums have been verified.
  if (/^MONGODB_URI=.*$/m.test(content)) content = content.replace(/^MONGODB_URI=.*$/m, 'MONGODB_URI=' + targetUri);
  else content += '\nMONGODB_URI=' + targetUri + '\n';
  if (!envExists) {
    content = content.replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET=' + randomBytes(32).toString('hex'));
    content = content.replace(/^COOKIE_SECRET=.*$/m, 'COOKIE_SECRET=' + randomBytes(32).toString('hex'));
  }
  await writeFile(envPath + '.setup-tmp', content, { mode: 0o600 });
  await rename(envPath + '.setup-tmp', envPath);
  console.log('backend/.env now uses the replica set. Private backups: ' + backupDirectory);
  console.log('Run npm run dev:backend, then npm run dev:frontend in another terminal.');
}

try {
  const envExists = existsSync(envPath);
  const content = await readFile(envExists ? envPath : path.join(root, 'backend', '.env.example'), 'utf8');
  const config = dotenv.parse(content);
  await startReplica(config);
  if (process.argv.includes('--import-current')) await configureEnvironment(content, config, envExists);
  else console.log('MONGODB_URI=mongodb://127.0.0.1:27019/booking_cinema?replicaSet=cinemaLocal');
} catch (error) {
  console.error('Local database setup failed: ' + error.message);
  process.exitCode = 1;
}
