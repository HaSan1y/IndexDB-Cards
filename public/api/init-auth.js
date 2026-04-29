const { generateAuthenticationOptions } = require("@simplewebauthn/server");
// const { getUserByUsername } = require("./db/wds-basicDB.js");
const { getUserByUsername, getUserPassKeyForVerification, getUserById } = require("./db/vercelDB.js");
const bcrypt = require("bcrypt");

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

module.exports = async (req, res) => {
	const origin = req.headers.origin;
	const host = req.headers.host;
	console.log(`[Vercel Init-Register] Received Request: Method=${req.method}, Origin='${origin}', Host='${host}'`);
	let isAllowed = false;
	let effectiveOrigin = origin;
	const vercelHost = "db-2-cards.vercel.app";
	const vercelOrigin = "https://db-2-cards.vercel.app";
	const netlifyHost = "elegant-bubblegum-a62895.netlify.app";
	const netlifyOrigin = "https://elegant-bubblegum-a62895.netlify.app";
	const localhost3000Host = "localhost:3000";
	const localhost3000Origin = "http://localhost:3000";
	const localhost8888Host = "localhost:8888"; // Common for `netlify dev`
	const localhost8888Origin = "http://localhost:8888";
	// Check 1: Standard CORS check (Origin header is present and allowed)
	// Consolidate allowed origins check
	const CURRENT_ALLOWED_ORIGINS = [localhost3000Origin, localhost8888Origin, vercelOrigin, netlifyOrigin];
	if (origin && CURRENT_ALLOWED_ORIGINS.includes(origin)) {
		isAllowed = true;
		effectiveOrigin = origin;
	}
	// Check 2: Allow same-origin from localhost (Origin header is missing, but host matches)
	else if (!origin) {
		if (host === localhost3000Host) {
			// This assumes your local dev server runs on port 3000
			isAllowed = true;
			// For the response header, reconstruct the expected local origin
			effectiveOrigin = localhost3000Origin;
			console.warn("Allowing same-origin request from host 'localhost:3000' (Origin header undefined).");
		} else if (host === localhost8888Host) {
			isAllowed = true;
			effectiveOrigin = localhost8888Origin;
			console.warn("Allowing same-origin request from host 'localhost:8888' (Origin header undefined).");
		} else if (host === vercelHost) {
			isAllowed = true;
			effectiveOrigin = vercelOrigin;
			console.warn(`Allowing same-origin request from host '${vercelHost}' (Origin header undefined).`);
		} else if (host === netlifyHost) {
			isAllowed = true;
			effectiveOrigin = netlifyOrigin;
			console.warn(`Allowing same-origin request from host '${netlifyHost}' (Origin header undefined).`);
		}
	}
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
	if (!isAllowed) {
		console.error(`Request blocked: Origin='${origin}', Host='${host}'. Allowed Origins: ${ALLOWED_ORIGINS.join(", ")}`);
		return res.status(403).json({ error: "Invalid request origin/host" });
	}

	res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Content-Type", "application/json");
	const currentRpConfig = RP_CONFIG[effectiveOrigin]; // intr edgecases

	if (!currentRpConfig) {
		console.error(`No RP config found for allowed origin: ${effectiveOrigin}`);
		return res.status(500).json({ error: "Server configuration error for origin" });
	}
	// const username = req.query?.username;
	const { username, password } = req.body;

	if (!username) {
		return res.status(400).json({ error: "Username is required" });
	}
	if (!password) {
		return res.status(400).json({ error: "Password is required" });
	}

	const user = await getUserByUsername(username);

	if (!user || !user.passwordHash) {
		console.log(`Login failed for ${username}: User not found or no password hash.`);
		return res.status(401).json({ error: "Invalid credentials" });
	}
	let isPasswordValid = false;
	try {
		isPasswordValid = await bcrypt.compare(password, user.passwordHash);
	} catch (compareError) {
		console.error(`Error comparing password for ${username}:`, compareError);
		return res.status(500).json({ error: "Error during authentication process" });
	}

	if (!isPasswordValid) {
		console.log(`Login failed for ${username}: Invalid password.`);
		return res.status(401).json({ error: "Invalid username or password" });
	}

	// --- PASSWORD IS VALID ---
	console.log(`Password verified for ${username}. Checking for passkey..`);

	// Now, check if the user has a passkey registered for WebAuthn login
	const authenticatorData = await getUserPassKeyForVerification(user.id);
	if (!authenticatorData || !authenticatorData.credentialID) {
		console.log(`User ${username} authenticated with password, but no passkey ID found in user object for WebAuthn options generation.`);
		console.log(`Result from getUserPassKeyForVerification:`, authenticatorData);

		// You might still want to return an error here if passkey login is mandatory after password
		return res.status(400).json({ error: "Password correct, but no passkey registered or passkey data is invalid. Cannot proceed with passkey login." });
	}
	console.log(`  Using Credential ID (Buffer converted to base64url for logging): ${authenticatorData.credentialID.toString("base64url")}`);
	try {
		// const credentialIDBuffer = Buffer.from(authenticatorData.credentialID, "base64url");
		//const credentialIDString = authenticatorData.credentialID.toString("base64url");
		const options = await generateAuthenticationOptions({
			rpID: currentRpConfig.rpId,
			allowCredentials: [
				{
					id: authenticatorData.credentialID.toString("base64url"),
					//credentialID: credentialIDString, //credentialIDBuffer, //authenticatorData.credentialID, //.toString("base64url"),
					type: "public-key",
					transports: authenticatorData.transports,
				},
			],
			userVerification: "preferred", // Or 'required' or 'discouraged'
		});
		// await kv.setex(`challenge:${sessionID}`, 300, options.challenge);

		//   return options;
		if (!options || !options.challenge || options.allowCredentials.length === 0) {
			console.warn(`generateAuthenticationOptions returned invalid options or empty allowCredentials for ${username}, even though authenticatorData seemed valid.`);
			console.warn(`Authenticator Data Sent:`, authenticatorData);
			console.warn(`Generated Options:`, options);
			return res.status(500).json({ error: "Failed to generate valid authentication options." });
		}

		console.log(`Successfully generated WebAuthn options for ${username}.`);
		// 		const sessionId = crypto.randomBytes(16).toString('hex');
		// await kv.setex(`challenge:${sessionId}`, 300, options.challenge);
		// 		await kv.set(`user:${username}`, {
		//   passkeys: [{
		//     credentialID: response.id // Already base64url from WebAuthn
		//   }]
		// });

		// res.setHeader(
		// 	"Set-Cookie",
		// 	`authInfo=${encodeURIComponent(
		// 		JSON.stringify({
		// 			userId: user.id,
		// 			challenge: options.challenge,
		// 		}),
		// 	)}; HttpOnly; Path=/; Max-Age=300; Secure; SameSite=None`,
		// );

		// return res.status(200).json(options);
		return res.status(200).json({
			options: options, // The options object for the browser's startAuthentication
			challenge: options.challenge, // The challenge to be verified later
			userId: user.id, // The user ID to be used in the verification step
		});
	} catch (error) {
		console.error(`Error generating authentication options for ${username}:`, error);
		// Log the authenticator data that caused the error
		console.error(`Authenticator Data used:`, authenticatorData);
		return res.status(500).json({ error: "Failed to generate authentication options" });
	}
};
