const { verifyAuthenticationResponse } = require("@simplewebauthn/server");
// const { updateUserCounter, getUserById } = require("./db/wds-basicDB.js");
const { updateUserCounter, getUserById, getUserPassKeyForVerification } = require("./db/vercelDB.js");

const ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"https://db-2-cards.vercel.app", // Vercel deployment
	"https://elegant-bubblegum-a62895.netlify.app", // Netlify deployment (if used)
	"http://localhost:8888",
];

// Relying Party configuration based on the origin
const RP_CONFIG = {
	"http://localhost:3000": {
		rpId: "localhost", // RP ID for local development MUST be 'localhost'
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
	const host = req.headers.host; // e.g., 'localhost:3000'
	// console.log(`[Vercel Init-Register] Received Request: Method=${req.method}, Origin='${origin}', Host='${host}'`);
	let isAllowed = false;
	let effectiveOrigin = origin;

	const vercelHost = "db-2-cards.vercel.app";
	const vercelOrigin = "https://db-2-cards.vercel.app";
	const netlifyHost = "elegant-bubblegum-a62895.netlify.app";
	const netlifyOrigin = "https://elegant-bubblegum-a62895.netlify.app";
	const localhost3000Host = "localhost:3000";
	const localhost3000Origin = "http://localhost:3000";
	const localhost8888Host = "localhost:8888";
	const localhost8888Origin = "http://localhost:8888";
	const CURRENT_ALLOWED_ORIGINS = [localhost3000Origin, localhost8888Origin, vercelOrigin, netlifyOrigin];
	if (origin && CURRENT_ALLOWED_ORIGINS.includes(origin)) {
		isAllowed = true;
		effectiveOrigin = origin;
	} else if (!origin) {
		if (host === localhost3000Host) {
			isAllowed = true;
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

	// --- CORS Preflight Handling (OPTIONS request) ---
	if (req.method === "OPTIONS") {
		if (isAllowed && RP_CONFIG[effectiveOrigin]) {
			res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
			res.setHeader("Access-Control-Allow-Credentials", "true");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			return res.status(204).end();
		} else {
			console.error(`OPTIONS request blocked: Origin='${origin}', effectiveOrigin='${effectiveOrigin}' , Host='${host}'`);
			return res.status(403).json({ error: "Origin not allowed" });
		}
	}

	// --- Actual Request Handling ---
	if (!isAllowed) {
		console.error(`Request blocked: Origin='${origin}', effectiveOrigin='${effectiveOrigin}', Host='${host}'. Allowed Origins: ${ALLOWED_ORIGINS.join(", ")}`);
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
	const { expectedChallenge, userId, ...webAuthnResponse } = req.body; // Separate challenge/userId from the actual WebAuthn response

	if (!expectedChallenge) {
		console.error("Verification failed: Missing expected challenge in request body.");
		return res.status(400).json({ error: "Missing challenge for verification." });
	}
	if (!userId) {
		console.error("Verification failed: Missing user ID in request body.");
		return res.status(400).json({ error: "Missing user identifier for verification." });
	}
	if (!webAuthnResponse || !webAuthnResponse.id || !webAuthnResponse.rawId || !webAuthnResponse.response || !webAuthnResponse.type) {
		console.error("Verification failed: Incomplete WebAuthn response data in request body.");
		return res.status(400).json({ error: "Incomplete WebAuthn response." });
	}
	const user = await getUserById(userId);
	if (!user) {
		console.error(`User not found during verification: User ID ${userId}`);
		return res.status(400).json({ error: "User associated with this login attempt not found." });
	}
	const authenticatorData = await getUserPassKeyForVerification(userId);

	if (!authenticatorData) {
		console.error(`[VERIFY-AUTH] CRITICAL: getUserPassKeyForVerification returned null or undefined for userId: ${userId}. Cannot proceed with WebAuthn verification.`);
		// Log the user object to see if passKey was missing or malformed there
		const userForDebug = await getUserById(userId);
		console.error(`[VERIFY-AUTH] User data at time of failure:`, JSON.stringify(userForDebug));
		return res.status(400).json({ error: "Passkey data for this user is missing or invalid. Cannot verify." });
	}

	// If authenticatorData is not null, log its contents
	console.log(
		`[VERIFY-AUTH] Authenticator data for verification (userId: ${userId}):`,
		JSON.stringify(authenticatorData, (key, value) => {
			if (value && value.type === "Buffer" && Array.isArray(value.data)) {
				return `Buffer(<${Buffer.from(value.data).toString("base64url")}>)`;
			}
			if (value instanceof Buffer) {
				// Handle direct Buffer instances too
				return `Buffer(<${value.toString("base64url")}>)`;
			}
			return value;
		}),
	);

	if (!authenticatorData.credentialID || !(authenticatorData.credentialID instanceof Buffer) || authenticatorData.credentialID.length === 0) {
		console.error(
			`[VERIFY-AUTH] CRITICAL: authenticatorData.credentialID is invalid. Type: ${typeof authenticatorData.credentialID}, IsBuffer: ${authenticatorData.credentialID instanceof Buffer}, Length: ${
				authenticatorData.credentialID?.length
			}`,
		);
		console.error(`[VERIFY-AUTH] Full authenticatorData (raw):`, authenticatorData);
		return res.status(500).json({ error: "Internal error: Invalid authenticator data structure." });
	}
	console.log(
		`[VERIFY-AUTH] authenticatorData.credentialID is a Buffer of length ${authenticatorData.credentialID.length}, value (base64url): ${authenticatorData.credentialID.toString("base64url")}`,
	);

	// Pre-flight check
	if (!authenticatorData.credentialID) {
		console.error("[VERIFY-AUTH PRE-FLIGHT CHECK] authenticatorData.credentialID IS FALSY! This is unexpected given previous logs.", authenticatorData.credentialID);
		return res.status(500).json({ error: "Internal pre-flight check: credentialID is falsy." });
	} else {
		console.log(
			`[VERIFY-AUTH PRE-FLIGHT CHECK] authenticatorData.credentialID IS TRUTHY. Type: ${typeof authenticatorData.credentialID}, Is Buffer: ${
				authenticatorData.credentialID instanceof Buffer
			}, Length: ${authenticatorData.credentialID.length}`,
		);
	}

	console.log(`Attempting verification for user ${user.username} (ID: ${userId}) with challenge: ${expectedChallenge}`);
	console.log("credentialID:", authenticatorData.credentialID.toString("base64url"));
	console.log("authenticatorData.credentialID:", authenticatorData.credentialID);
	console.log('authenticatorData.credentialID.toString("base64url"):', authenticatorData.credentialID.toString("base64url"));
	console.log("webAuthnResponse.response:", webAuthnResponse.response);
	console.log("expectedChallenge:", expectedChallenge);
	console.log("effectiveOrigin:", effectiveOrigin);
	console.log("currentRpConfig.rpId:", currentRpConfig.rpId);
	// const credentialID = authenticatorData.credentialID.toString("base64url");
	// console.log('credentialID:', credentialID);
	//const credentialIDBuffer = Buffer.from(authenticatorData.credentialID, "base64url");
	//console.log("credentialIDBuffer:", credentialIDBuffer);
	try {
		const verification = await verifyAuthenticationResponse({
			response: webAuthnResponse.response,
			expectedChallenge: expectedChallenge,
			expectedOrigin: effectiveOrigin,
			expectedRPID: currentRpConfig.rpId,
			authenticator: {
				credentialID: authenticatorData.credentialID, // credentialIDBuffer, //.tostring("base64url"), user.passKey.id
				credentialPublicKey: authenticatorData.credentialPublicKey,
				counter: authenticatorData.counter,
				transports: authenticatorData.transports,
			},
			requireUserVerification: false,
		});

		if (verification.verified) {
			console.log(`Verification successful for user ${user.username} (ID: ${userId}).`);
			// Update the authenticator counter in the DB
			try {
				console.log(`Attempting to update counter from ${authenticatorData.counter} to ${verification.authenticationInfo.newCounter}`);
				await updateUserCounter(userId, verification.authenticationInfo.newCounter);
				console.log(`Counter updated successfully for user ${userId}.`);
			} catch (updateError) {
				// Log the error but potentially still consider the login successful
				console.error(`!!! FAILED to update counter for user ${userId} after successful verification:`, updateError);
				// Rethrow or handle specifically
				//throw updateError; // Pass it to the outer catch
			}
			return res.status(200).json({ verified: true, username: user.username }); // Send username back for confirmation
		} else {
			console.warn(`Verification failed for user ${userId}:`, verification);
			return res.status(400).json({ verified: false, error: "Passkey verification failed." });
		}
	} catch (error) {
		console.error(`Verification failed for user ${userId}:`, error);
		return res.status(400).json({ verified: false, error: "Passkey verification failed." });
	}
};
