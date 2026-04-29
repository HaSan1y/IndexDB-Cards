const { kv } = require("@vercel/kv");
const { Buffer } = require("buffer");

async function createUser(userId, username, email, passwordHash, passKeyData) {
	console.log(`KV: Creating user ${username} with ID ${userId}`);
	const user = {
		id: userId,
		username,
		email,
		passwordHash,
		passKey: passKeyData,
	};

	await kv.set(`user:${userId}`, user);
	await kv.set(`user_by_username:${username}`, userId);
	if (email) {
		// Only set email index if email is provided
		await kv.set(`user_by_email:${email}`, userId);
	}
	console.log(`KV: User ${username} created successfully.`);
	return user;
}

async function getUserByUsername(username) {
	console.log(`KV: Searching for user with username: ${username}`);
	// 1. Find the user ID associated with the username
	const userId = await kv.get(`user_by_username:${username}`);
	if (!userId) {
		console.log(`KV: No user ID found for username: ${username}`);
		return null;
	}
	// 2. Retrieve the full user object using the ID
	const user = await kv.get(`user:${userId}`);
	if (!user) {
		console.log(`KV: No user data found for user ID: ${userId}`);
		return null;
	}
	// console.log(`KV: Found user for ID ${userId}:`, user ? "User data retrieved" : "User data not found");
	return user;
}

async function getUserById(userId) {
	console.log(`KV: Searching for user with ID: ${userId}`);
	const user = await kv.get(`user:${userId}`);
	if (!user) {
		console.log(`KV: No user data found for user ID: ${userId}`);
		return null;
	}
	console.log(`KV: Found user for ID ${userId}:`, user ? "User data retrieved" : "User data not found");
	return user;
}
async function getUserByEmail(email) {
	console.log(`KV: Searching for user with email: ${email}`);
	// 1. Find the user ID associated with the email
	const userId = await kv.get(`user_by_email:${email}`); // <-- Use the correct index key
	if (!userId) {
		console.log(`KV: No user ID found for email: ${email}`);
		return null;
	}
	// 2. Retrieve the full user object using the ID
	console.log(`KV: Found user ID ${userId} for email ${email}. Fetching user object.`);
	const user = await kv.get(`user:${userId}`);
	if (!user) {
		console.log(`KV: No user data found for user ID: ${userId}`);
		return null;
	}
	console.log(`KV: Found user for ID ${userId}:`, user ? "User data retrieved" : "User data not found");
	return user;
}

async function updateUserCounter(userId, newCounter) {
	console.log(`KV: Updating counter for user ID ${userId} to ${newCounter}`);
	const user = await getUserById(userId);
	if (!user) {
		console.error(`KV: Cannot update counter, user not found: ${userId}`);
		return;
	}
	user.passKey.counter = newCounter;
	await kv.set(`user:${userId}`, user);
	console.log(`KV: Counter updated for user ${userId}.`);
}
async function addPassKeyToUser(userId, passKeyData) {
	console.log(`KV: Adding/Updating passkey for user ID ${userId}`);
	const user = await getUserById(userId);
	if (!user) {
		console.error(`KV: Cannot add passkey, user not found: ${userId}`);
		return null;
	}
	user.passKey = passKeyData;
	// user.passKey = {
	// 	id: passKeyData.id.toString("base64url"),
	// 	publicKey: passKeyData.publicKey.toString("base64"),
	// 	counter: passKeyData.counter,
	// 	transports: passKeyData.transports,
	// }; 
	await kv.set(`user:${userId}`, user);
	console.log(`KV: Passkey added/updated for user ${userId}.`);
	return user;
}
async function getUserPassKeyForVerification(userId) {
	console.log(`KV: Getting passkey for verification for user ID: ${userId}`);
	const userData = await getUserById(userId);
	if (!userData) {
		console.error(`KV: User not found for verification: ${userId}`);
		return null;
	}
	if (!userData.passKey || typeof userData.passKey.counter !== "number") {
		console.warn(`KV: User ${userId} found, but passKey data is missing or malformed.`);
		console.warn(`KV: passKey data:`, userData?.passKey);
		return null;
	}
	const rawId = userData.passKey.id;
	const rawPublicKey = userData.passKey.publicKey;
	let credentialID;
	let credentialPublicKey;
	try {
		if (typeof rawId === "string") {
			credentialID = Buffer.from(rawId, "base64url");
		} else if (Buffer.isBuffer(rawId) || rawId instanceof Uint8Array) {
			credentialID = Buffer.from(rawId);
		} else if (rawId && rawId.type === "Buffer" && Array.isArray(rawId.data)) {
			credentialID = Buffer.from(rawId.data);
		} else {
			throw new Error(`Unsupported passKey.id format: ${typeof rawId}`);
		}

		if (typeof rawPublicKey === "string") {
			credentialPublicKey = Buffer.from(rawPublicKey, "base64");
		} else if (Buffer.isBuffer(rawPublicKey) || rawPublicKey instanceof Uint8Array) {
			credentialPublicKey = Buffer.from(rawPublicKey);
		} else if (rawPublicKey && rawPublicKey.type === "Buffer" && Array.isArray(rawPublicKey.data)) {
			credentialPublicKey = Buffer.from(rawPublicKey.data);
		} else {
			throw new Error(`Unsupported passKey.publicKey format: ${typeof rawPublicKey}`);
		}

		return {
			credentialID,
			credentialPublicKey,
			counter: userData.passKey.counter,
			transports: userData.passKey.transports,
		};
	} catch (error) {
		console.error(`KV: Error converting passKey data for user ${userId}:`, error);
		console.error(`KV: Faulty passKey data:`, userData.passKey);
		return null;
	}
}
module.exports = {
	createUser,
	updateUserCounter,
	getUserPassKeyForVerification,
	getUserById,
	getUserByUsername,
	getUserByEmail,
	addPassKeyToUser,
};
