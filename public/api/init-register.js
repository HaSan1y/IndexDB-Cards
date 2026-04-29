const { generateRegistrationOptions } = require("@simplewebauthn/server");
const crypto = require("crypto");
const { getUserByEmail } = require("./db/vercelDB.js");
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
		rpId: "localhost",
		rpName: "Local Dev h451",
	},
	"http://127.0.0.1:3000": {
		rpId: "127.0.0.1",
		rpName: "Local Dev h451",
	},
	"https://db-2-cards.vercel.app": {
		rpId: "db-2-cards.vercel.app",
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

//////////////////////////////////////////////////////////////////////////////////////////////verce
module.exports = async (req, res) => {
	const origin = req.headers.origin;
	const host = req.headers.host;
	console.log(`[Vercel Init-Register] Received Request: Method=${req.method}, Origin='${origin}', Host='${host}'`);
	let isAllowed = false;
	let effectiveOrigin = origin;
	const ORIGIN_HOST_MAP = {
		"localhost:3000": "http://localhost:3000",
		"127.0.0.1:3000": "http://127.0.0.1:3000",
		"localhost:8888": "http://localhost:8888",
		"127.0.0.1:8888": "http://127.0.0.1:8888",
		"db-2-cards.vercel.app": "https://db-2-cards.vercel.app",
		"elegant-bubblegum-a62895.netlify.app": "https://elegant-bubblegum-a62895.netlify.app",
	};
	const CURRENT_ALLOWED_ORIGINS = Object.values(ORIGIN_HOST_MAP);
	if (origin && CURRENT_ALLOWED_ORIGINS.includes(origin)) {
		isAllowed = true;
		effectiveOrigin = origin;
	} else if (!origin && host && ORIGIN_HOST_MAP[host]) {
		isAllowed = true;
		effectiveOrigin = ORIGIN_HOST_MAP[host];
		console.warn(`Allowing same-origin request from host '${host}' (Origin header undefined).`);
	}

	// --- CORS Preflight Handling (OPTIONS request) ---
	if (req.method === "OPTIONS") {
		if (isAllowed && RP_CONFIG[effectiveOrigin]) {
			res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
			res.setHeader("Access-Control-Allow-Credentials", "true");
			res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			return res.status(204).end();
		} else {
			console.error(`OPTIONS request blocked: Origin='${origin}', Host='${host}'`);
			return res.status(403).json({ error: "Origin not allowed" });
		}
	}

	// --- Actual Request Handling ---
	if (!isAllowed) {
		console.error(`Request blocked: Origin='${origin}', Host='${host}'. Allowed Origins: ${ALLOWED_ORIGINS.join(", ")}`);
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
	const email = req.query.email || "user@example.com";
	const username = req.query.username || "user";
	if (!email || !username) {
		return res.status(400).json({ error: "Email or username is required" });
	}

	// const excludeCredentials = existingUser?.passKey?.id ? [{ id: Buffer.from(existingUser.passKey.id, "base64url"), type: "public-key" }] : [];
	const existingUser = await getUserByEmail(email);
	if (existingUser) {
		// Check if not null/undefined
		console.log(`Registration init failed: Email ${email} already exists.`);
		return res.status(400).json({ error: "Email already registered" });
	}
	try {
		console.log(`Generating registration options for email: ${email}`);
		let userIdBuffer;
		if (existingUser && existingUser.id) {
			userIdBuffer = Buffer.from(existingUser.id, "base64url");
		} else {
			userIdBuffer = crypto.randomBytes(16);
		}
		const options = await generateRegistrationOptions({
			rpId: currentRpConfig.rpId,
			rpName: currentRpConfig.rpName,
			userID: userIdBuffer,
			//  userID: isoUint8Array.fromUTF8String('customUserIDHere'),
			// user: {
			// 	id: userIdBuffer,
			// 	name: email,
			// 	displayName: email,
			// },
			userName: username,
			userDisplayName: username,
			attestationType: "none", // Optional: 'none' is common for less strict requirements
			authenticatorSelection: {
				residentKey: "preferred", // Allow discoverable credentials (passkeys)
				requireResidentKey: false,
				userVerification: "preferred", // Prefer biometrics/PIN but don't require
			},
			// excludeCredentials: [], // Can be used if you track multiple credentials per user
		});
		console.log(`Generated options for ${email}. User ID: ${options.user.id}, Challenge: ${options.challenge}`);

		// res.cookie(
		// res.setHeader(
		// 	"Set-Cookie",
		// 	`regInfo=${encodeURIComponent(
		// 		JSON.stringify({
		// 			userId: options.user.id,
		// 			email,
		// 			challenge: options.challenge,
		// 		}),
		// 	)}; HttpOnly; Path=/; Max-Age=60; Secure; SameSite=None`,
		// );
		return res.status(200).json({
			options,
			challenge: options.challenge, // Pass challenge needed for verification
			userId: userIdBuffer.toString("base64url"), //options.user.id, // Pass generated user ID needed for verification/creation
			email, // Pass email back for confirmation/use in verify step
		});
	} catch (error) {
		console.error("Error generating registration options:", error);
		return res.status(500).json({ error: "Failed to initialize registration" });
	}
};
