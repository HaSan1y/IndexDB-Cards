//credits to @webdevsimplified https://www.youtube.com/watch?v=viZs1iVsLpA
//https://www.freecodecamp.org/news/learn-rest-api-principles-by-building-an-express-app

const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require("@simplewebauthn/server");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { USERS, getUserByUsername, getUserByEmail, createUser, updateUserCounter, getUserById } = require("./wds/db.js");
const dbModule = require("./wds/db.js");
console.log("Imported from db.js:", dbModule);
// const { USERS, createUser } = require("./db.js");

const app = express();
app.use(express.json());
app.use(cookieParser());
const CLIENT_URL = "https://db-2-cards.vercel.app"; //| http://localhost:5500";| not127.0.0.1 invalid
// const RP_ID = "localhost";
const RP_ID = "db-2-cards.vercel.app";

// After your app.listen() call
createUser("testuser1", "test1@example.com", {
	/* mock passKey data */
});
createUser("testuser2", "test2@example.com", {
	/* mock passKey data */
});
console.log("Test users created:", USERS);

app.use(cors({ origin: CLIENT_URL, credentials: true }));

// app.use((req, res, next) => {
// 	  if (!req.body.title || !req.body.genre || !req.body.year) {
//       return res.status(400).send('Title, genre, and year are required');
//   }
// 	res.header("Access-Control-Allow-Origin", "CLIENT_URL");
// 	res.header("Access-Control-Allow-Credentials", true);
// 	next();
// });

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// module.exports = async (req, res) => {  //vercel
// exports.handler = async (event) => { // netlify
app.get(`/init-register`, async (req, res) => {
	const email = req.query.email;
	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	if (getUserByEmail(email) != null) {
		return res.status(400).json({ error: "User already exists" });
	}

	const options = await generateRegistrationOptions({
		rpID: RP_ID,
		rpName: "h451",
		userName: email,
	});
	console.log("Registration options:", options);

	res.cookie(
		"regInfo",
		JSON.stringify({
			userId: options.user.id,
			email,
			challenge: options.challenge,
		}),
		{ httpOnly: true, maxAge: 60000, secure: true },
	);

	res.json(options);
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post(`/verify-register`, async (req, res) => {
	let regInfo;
	try {
		regInfo = JSON.parse(req.cookies.regInfo || "{}");
	} catch (e) {
		return res.status(400).json({ error: "Invalid registration cookie" });
	}

	if (!regInfo || !regInfo.challenge) {
		return res.status(400).json({ error: "Registration info not found" });
	}

	const verification = await verifyRegistrationResponse({
		response: req.body,
		expectedChallenge: regInfo.challenge,
		expectedOrigin: CLIENT_URL,
		expectedRPID: RP_ID,
	});

	if (verification.verified) {
		createUser(regInfo.userId, regInfo.email, {
			id: verification.registrationInfo.credentialID,
			publicKey: verification.registrationInfo.credentialPublicKey,
			counter: verification.registrationInfo.counter,
			deviceType: verification.registrationInfo.credentialDeviceType,
			backedUp: verification.registrationInfo.credentialBackedUp,
			transport: req.body.transports,
		});
		res.clearCookie("regInfo");
		return res.json({ verified: verification.verified });
	} else {
		return res.status(400).json({ verified: false, error: "Verification failed" });
	}
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get(`/init-auth`, async (req, res) => {
	const username = req.query.username;
	console.log("Received auth request for username:", username);
	if (!username) {
		return res.status(400).json({ error: "Username is required" });
	}

	const user = getUserByUsername(username);
	console.log("User found:", user);
	if (user == null) {
		return res.status(400).json({ error: "No user for this username" });
	}

	const options = await generateAuthenticationOptions({
		rpID: RP_ID,
		allowCredentials: [
			{
				id: user.passKey.id,
				type: "public-key",
				transports: user.passKey.transports,
			},
		],
	});

	res.cookie(
		"authInfo",
		JSON.stringify({
			userId: user.id,
			challenge: options.challenge,
		}),
		{ httpOnly: true, maxAge: 60000, secure: true },
	);

	res.json(options);
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post(`/verify-auth`, async (req, res) => {
	let authInfo;
	try {
		authInfo = JSON.parse(req.cookies.authInfo || "{}");
	} catch (e) {
		return res.status(400).json({ error: "Invalid auth cookie" });
	}
	if (!authInfo || !authInfo.challeng) {
		return res.status(400).json({ error: "Authentication info not found" });
	}

	const user = getUserById(authInfo.userId);
	if (user == null || user.passKey.id != req.body.id) {
		return res.status(400).json({ error: "Invalid user" });
	}

	const verification = await verifyAuthenticationResponse({
		response: req.body,
		expectedChallenge: authInfo.challenge,
		expectedOrigin: CLIENT_URL,
		expectedRPID: RP_ID,
		authenticator: {
			credentialID: user.passKey.id,
			credentialPublicKey: user.passKey.publicKey,
			counter: user.passKey.counter,
			transports: user.passKey.transports,
		},
	});

	if (verification.verified) {
		updateUserCounter(user.id, verification.authenticationInfo.newCounter);
		res.clearCookie("authInfo");
		// Save user in a session cookie
		return res.json({ verified: verification.verified });
	} else {
		return res.status(400).json({ verified: false, error: "Verification failed" });
	}
});

app.listen(3000, () => {
	console.log("Server is running on http://localhost:3000");
});
