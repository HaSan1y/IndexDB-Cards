const { verifyRegistrationResponse } = require("@simplewebauthn/server");
const { createUser, getUserByUsername, getUserByEmail } = require("./db/vercelDB.js");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const saltRounds = 10;
const { Buffer } = require("buffer");

const ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:8888",
	"http://127.0.0.1:8888",
	"https://db-2-cards.vercel.app",
	"https://elegant-bubblegum-a62895.netlify.app",
];

// Relying Party configuration based on the origin
const RP_CONFIG = {
	"http://localhost:3000": {
		rpId: "localhost", // RP ID for local development MUST be 'localhost'
		rpName: "Local Dev h451",
	},
	"http://127.0.0.1:3000": {
		rpId: "127.0.0.1",
		rpName: "Local Dev h451",
	},
	"https://db-2-cards.vercel.app": {
		rpId: "db-2-cards.vercel.app", // RP ID for Vercel MUST match the domain
		rpName: "Vercel h451",
	},
	"https://elegant-bubblegum-a62895.netlify.app": {
		rpId: "elegant-bubblegum-a62895.netlify.app",
		rpName: "Netlify h451",
	},
	"http://localhost:8888": {
		rpId: "localhost",
		rpName: "Local Netlify Dev h451",
	},
	"http://127.0.0.1:8888": {
		rpId: "127.0.0.1",
		rpName: "Local Netlify Dev h451",
	},
};

// function parseCookies(cookieHeader) {
// 	const cookies = {};
// 	if (!cookieHeader) return cookies;
// 	cookieHeader.split(";").forEach((cookie) => {
// 		const [name, ...rest] = cookie.trim().split("=");
// 		cookies[name] = decodeURIComponent(rest.join("="));
// 	});
// 	return cookies;
// }
module.exports = async (req, res) => {
	const origin = req.headers.origin;
	const host = req.headers.host;
	console.log(`[Vercel Init-Register] Received Request: Method=${req.method}, Origin='${origin}', Host='${host}'`);
	let isAllowed = false;
	let effectiveOrigin = origin; // Will store the origin to use in response headers

	const ORIGIN_HOST_MAP = {
		"localhost:3000": "http://localhost:3000",
		"127.0.0.1:3000": "http://127.0.0.1:3000",
		"localhost:8888": "http://localhost:8888",
		"127.0.0.1:8888": "http://127.0.0.1:8888",
		"db-2-cards.vercel.app": "https://db-2-cards.vercel.app",
		"elegant-bubblegum-a62895.netlify.app": "https://elegant-bubblegum-a62895.netlify.app",
	};
	const CURRENT_ALLOWED_ORIGINS = Object.values(ORIGIN_HOST_MAP);
	// Check 1: Standard CORS check (Origin header is present and allowed)
	if (origin && CURRENT_ALLOWED_ORIGINS.includes(origin)) {
		isAllowed = true;
		effectiveOrigin = origin;
	}
	// Check 2: Allow same-origin from localhost (Origin header is missing, but host matches)
	else if (!origin && host && ORIGIN_HOST_MAP[host]) {
		isAllowed = true;
		effectiveOrigin = ORIGIN_HOST_MAP[host];
		console.warn(`Allowing same-origin request from host '${host}' (Origin header undefined).`);
	}

	// --- CORS Preflight Handling (OPTIONS request) ---
	if (req.method === "OPTIONS") {
		if (isAllowed && RP_CONFIG[effectiveOrigin]) {
			res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
			res.setHeader("Access-Control-Allow-Credentials", "true");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			return res.status(204).end();
		} else {
			console.error(`OPTIONS request blocked: Origin='${origin}', Host='${host}'`);
			return res.status(403).json({ error: "Origin not allowed" });
		}
	}

	// --- Actual Request Handling ---
	if (!isAllowed) {
		console.error(`Request blocked: Origin='${origin}', Host='${host}'. Allowed Origins: ${CURRENT_ALLOWED_ORIGINS.join(", ")}`);
		return res.status(403).json({ error: "Invalid request origin/host" });
	}
	res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Content-Type", "application/json");
	const currentRpConfig = RP_CONFIG[effectiveOrigin];
	if (!currentRpConfig) {
		console.error(`No RP config found for allowed origin: ${effectiveOrigin}`);
		return res.status(500).json({ error: "Server configuration error for origin" });
	}
	const {
		username,
		email,
		password,
		expectedChallenge, // Sent from client, originally from init-register
		userId,
		...webAuthnResponse
	} = req.body; // Extract username, email, and password from request body

	// const cookies = parseCookies(req.headers.cookie);
	// const regInfo = cookies.regInfo ? JSON.parse(cookies.regInfo) : null;

	if (!username || !email || !password) {
		console.error("Missing username, email, or password in request body for /verify-register");
		return res.status(400).json({ error: "Missing required registration fields (username, email, password)." });
	}
	if (!expectedChallenge) {
		console.error("Missing expected challenge in request body for /verify-register");
		return res.status(400).json({ error: "Missing challenge for verification." });
	}
	if (!userId) {
		console.error("Missing user ID in request body for /verify-register");
		return res.status(400).json({ error: "Missing user identifier for verification." });
	}
	if (!webAuthnResponse || !webAuthnResponse.id || !webAuthnResponse.rawId || !webAuthnResponse.response || !webAuthnResponse.type) {
		console.error("Verification failed: Incomplete WebAuthn response data in request body.");
		return res.status(400).json({ error: "Incomplete WebAuthn response." });
	}

	// if (!regInfo) {
	// 	return res.status(400).json({ error: "Registration session info not found (cookie missing or expired)." });
	// }
	// Optional: Check if email from body matches email from cookie for extra safety
	// if (email !== regInfo.email) {
	// 	console.error(`Email mismatch: Body='${email}', Cookie='${regInfo.email}'`);
	// 	return res.status(400).json({ error: "Email mismatch during registration." });
	// }
	const existingUserByUsername = await getUserByUsername(username);
	if (existingUserByUsername) {
		return res.status(400).json({ error: "Username already taken" }); // response indicating username taken
	}
	const existingUserByEmail = await getUserByEmail(email);
	if (existingUserByEmail) {
		return res.status(400).json({ error: "email already taken" });
	}
	let passwordHash;
	try {
		// Now 'password' should have a value from req.body
		passwordHash = await bcrypt.hash(password, saltRounds);
	} catch (hashError) {
		console.error("Error hashing password:", hashError);
		return res.status(500).json({ error: "Failed to process password." });
	}

	try {
		console.log(`Verifying registration for user ${username} (ID: ${userId}) with challenge: ${expectedChallenge}`);

		const verification = await verifyRegistrationResponse({
			response: webAuthnResponse, // Pass the entire WebAuthn credential object
			expectedChallenge: expectedChallenge,
			expectedOrigin: effectiveOrigin,
			expectedRPID: currentRpConfig.rpId,
			requireUserVerification: false, //
		});

		if (verification.verified && verification.registrationInfo) {
			const regInfoData = verification.registrationInfo;
			console.log(`Registration verified for ${username}. Storing user data.`);

			const passKeyDataForStorage = {
				id: Buffer.from(regInfoData.credential.id).toString("base64url"),
				publicKey: Buffer.from(regInfoData.credential.publicKey).toString("base64"),
				counter: regInfoData.credential.counter,

				deviceType: regInfoData.credentialDeviceType,
				backedUp: regInfoData.credentialBackedUp,
				transports: webAuthnResponse?.response?.transports || [],
			};
			await createUser(userId, username, email, passwordHash, passKeyDataForStorage);

			return res.status(200).json({ verified: true });
		} else {
			console.warn("WebAuthn registration verification failed:", verification);
			return res.status(400).json({ verified: false, error: "Passkey Verification failed" });
		}
	} catch (error) {
		console.error(`Error verifying registration response for ${username}:`, error);
		console.error("WebAuthn Response received:", webAuthnResponse);
		console.error("Expected Challenge:", expectedChallenge);
		return res.status(500).json({ error: "Internal server error during registration verification." });
	}
};
