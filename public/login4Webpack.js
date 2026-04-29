import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
// import { startAuthentication, startRegistration } from "@simplewebauthn/browser@10.0.0/dist/bundle/index.umd.min.js | https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@10.0.0/dist/bundle/index.umd.min.js";
console.log("Script loaded"); // This should appear when the page loads
const emailInput = document.querySelector("[data-email]");
const modal = document.querySelector("[data-modal]");
const closeButton = document.querySelector("[data-close]");

const SERVER_URL = (() => {
	const origin = window.location.origin;
	if (origin === "https://db-2-cards.vercel.app") return "https://db-2-cards.vercel.app/api/";
	if (origin === "https://elegant-bubblegum-a62895.netlify.app") return "https://elegant-bubblegum-a62895.netlify.app/.netlify/functions/N";
	if (origin === "http://localhost:8888") return "http://localhost:8888/.netlify/functions/N";
	if (origin === "http://localhost:3000") return "http://localhost:3000/api/";
	if (origin === "http://127.0.0.1:3000") return "http://127.0.0.1:3000/api/";
	if (origin === "http://127.0.0.1:8888") return "http://127.0.0.1:8888/.netlify/functions/N";
	if (origin && origin.startsWith("http")) return `${origin}/api/`;
	if (window.location.protocol === "file:") return "http://localhost:3000/api/";
	return "http://localhost:3000/api/";
})();

document.addEventListener("DOMContentLoaded", function () {
	console.log("DOM fully loaded");
	const form = document.getElementById("authForm");
	const formTitle = document.getElementById("formTitle");
	const formDescription = document.getElementById("formDescription");
	const emailGroup = document.getElementById("emailGroup");
	const submitButton = document.getElementById("submitButton");
	const toggleMode = document.getElementById("toggleMode");
	const toggleLabel = document.getElementById("toggleLabel");
	const errorMessage = document.getElementById("errorMessage");
	const successMessage = document.getElementById("successMessage");

	let isLoginMode = true;

	updateFormMode();

	toggleMode.addEventListener("change", function () {
		isLoginMode = !isLoginMode;
		updateFormMode();
	});

	function updateFormMode() {
		if (isLoginMode) {
			formTitle.textContent = "Login";
			formDescription.textContent = "Welcome back! Please login to your account.";
			emailGroup.style.display = "none";
			submitButton.textContent = "Login with Passkey";
			submitButton.removeAttribute("data-signup");
			submitButton.setAttribute("data-login", "");
			toggleLabel.textContent = "Need an account?";
		} else {
			formTitle.textContent = "Register";
			formDescription.textContent = "Create a new account to get started.";
			emailGroup.style.display = "block";
			submitButton.textContent = "Register with Passkey";
			submitButton.removeAttribute("data-login");
			submitButton.setAttribute("data-signup", "");
			toggleLabel.textContent = "Already have an account? Login";
		}
		errorMessage.textContent = "";
		successMessage.textContent = "";
		if (submitButton) submitButton.disabled = false;
	}

	if (submitButton) {
		submitButton.addEventListener("click", async (e) => {
			e.preventDefault();

			const usernameInput = document.getElementById("username");
			const emailInput = document.getElementById("email");
			const passwordInput = document.getElementById("password");

			const username = usernameInput.value.trim();
			const email = emailInput ? emailInput.value.trim() : "";
			const password = passwordInput.value;

			errorMessage.textContent = "";
			successMessage.textContent = "";

			if (!username) {
				errorMessage.textContent = "Username is required.";
				return;
			}

			// 2. Check Password (Required always)
			if (!password || password.length < 6) {
				console.log("Password validation failed");
				errorMessage.textContent = "Password is required and must be at least 6 characters long.";
				// You might add password complexity checks here later
				return;
			}

			// 3. Check Email (Required and Valid only in Register mode)
			if (!isLoginMode) {
				// These checks only apply when registering
				if (!email) {
					errorMessage.textContent = "Email is required for registration.";
					return;
				}
				function isValidEmail(email) {
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					return emailRegex.test(email);
				}
				if (!isValidEmail(email)) {
					errorMessage.textContent = "Please enter a valid email address.";
					return;
				}
			}
			console.log("Validation passed. Proceeding with", isLoginMode ? "Login" : "Registration");

			// Disable button to prevent multiple submissions
			submitButton.disabled = true;
			submitButton.textContent = isLoginMode ? "Logging in..." : "Registering...";

			// if (submitButton.hasAttribute("data-login")) {
			// 	console.log("Login attempt");
			// 	await login();
			// 	// window.location.reload();
			// } else if (submitButton.hasAttribute("data-signup")) {
			// 	console.log("Signup attempt");
			// 	await signup();
			// 	// window.location.reload();
			// } else {
			// 	console.log("Button has neither data-login nor data-signup attribute");
			// 	updateFormMode();
			// }
			try {
				// Wrap async calls in try/catch
				if (isLoginMode) {
					console.log("Login attempt");
					await login(username, password);
				} else {
					console.log("Signup attempt");
					await signup(username, email, password);
				}
				// Re-enable button only if no error occurred during the process
				// Note: Success/error messages are handled within login/signup now
				// submitButton.disabled = false; // Re-enabled within login/signup or in finally block
			} catch (error) {
				// Catch errors bubbled up from login/signup if they weren't handled there
				console.error("Unhandled error during auth process:", error);
				errorMessage.textContent = error.message || "An unexpected error occurred.";
			} finally {
				if (submitButton) {
					submitButton.disabled = false;
					updateFormMode();
				}
				// Optional: Ensure button is always re-enabled, regardless of success/failure handled within functions
				// Be careful if login/signup handle redirection, this might run too late or cause flicker
			}
		});
	} else {
		console.error("Submit button element not found");
	}
});

closeButton.addEventListener("click", () => modal.close());

async function signup(username, email, password) {
	console.log("Register function called");
	const errorMessage = document.getElementById("errorMessage");
	// const submitButton = document.getElementById("submitButton");
	const successMessage = document.getElementById("successMessage");

	let expectedChallenge,
		userIdForRegistration,
		emailFromInit = null;

	try {
		// wont work for netlify */N* gotta refactor l8
		// const effectiveApiUrl = SERVER_URL.endsWith("/") ? SERVER_URL : SERVER_URL + "/"; // Ensure trailing slash
		const effectiveApiUrl = SERVER_URL;

		// 1. Initialize Registration - Pass email as query param
		const initResponse = await fetch(`${effectiveApiUrl}init-register?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`, {
			method: "GET", // Assuming init-register is GET
			headers: { Accept: "application/json" },
			credentials: "include",
		});

		const initData = await initResponse.json(); // Always try to parse JSON
		console.log("initData:", initData);

		if (!initResponse.ok) {
			// Use error message from server response if available
			throw new Error(initData.error || `Registration initialization failed (${initResponse.status})`);
		}
		// Check if expected data is present in the response body
		if (!initData.options || !initData.challenge || !initData.userId || !initData.email) {
			console.error("Incomplete data received from init-register:", initData);
			throw new Error("Server did not provide necessary data to start passkey registration.");
		}
		const options = initData.options;
		if (!options.user || typeof options.user.name !== "string" || options.user.name === "") {
			console.error("CRITICAL (Client Check): options.user.name is missing or invalid in the object received from the server!", options.user);
			throw new Error("Server configuration error: User name missing in registration options. Please contact support or the administrator.");
		}
		// --- Add Detailed Logging ---
		console.log("Received options object:", JSON.stringify(options, null, 2));
		if (options.user) {
			console.log("Received options.user object:", JSON.stringify(options.user, null, 2));
			if (typeof options.user.name === "undefined") {
				console.error("CRITICAL: options.user.name is UNDEFINED in the object received from the server!");
			} else {
				console.log("options.user.name value:", options.user.name);
			}
		} else {
			console.error("CRITICAL: options.user is MISSING in the object received from the server!");
		}
		// --- End Detailed Logging ---
		/*
		// Utility to convert base64url string to Uint8Array
		function base64urlToUint8Array(base64urlString) {
			const padding = "=".repeat((4 - (base64urlString.length % 4)) % 4);
			const base64 = (base64urlString + padding).replace(/-/g, "+").replace(/_/g, "/");
			const rawData = window.atob(base64);
			const outputArray = new Uint8Array(rawData.length);
			for (let i = 0; i < rawData.length; ++i) {
				outputArray[i] = rawData.charCodeAt(i);
			}
			return outputArray;
		}

		// Convert certain fields from base64url string to Uint8Array as required by WebAuthn API
		const cleanOptions = { ...options };
		cleanOptions.challenge = base64urlToUint8Array(cleanOptions.challenge);
		if (cleanOptions.user && cleanOptions.user.id) {
			cleanOptions.user.id = base64urlToUint8Array(cleanOptions.user.id);
		}
		if (cleanOptions.excludeCredentials) {
			cleanOptions.excludeCredentials = cleanOptions.excludeCredentials.map((cred) => {
				return {
					...cred,
					id: base64urlToUint8Array(cred.id),
				};
			});
		}
		 delete cleanOptions.hints;
		 delete cleanOptions.extensions;*/
		expectedChallenge = initData.challenge;
		userIdForRegistration = initData.userId;
		emailFromInit = initData.email;

		console.log(`init-register successful. Challenge: ${expectedChallenge}, UserID: ${userIdForRegistration}`);

		// Optional: Verify email consistency (should match)
		if (email !== emailFromInit) {
			console.warn(`Email mismatch between form ('${email}') and init-register response ('${emailFromInit}'). Using server response.`);
			// Decide if this is an error or just use emailFromInit
		}

		// 2. Start WebAuthn Registration Ceremony
		let regJSON;
		//  const minimalOptionsForBrowser = {
		//       challenge: options.challenge,
		//       rp: options.rp,
		//       user: options.user, // Ensure this includes id, name, displayName
		//       pubKeyCredParams: options.pubKeyCredParams,
		//       timeout: options.timeout,
		//       attestation: options.attestation,
		//       authenticatorSelection: options.authenticatorSelection
		//       // Intentionally omit: excludeCredentials, extensions, hints
		//  };
		//  console.log("Calling startRegistration with MINIMAL options:", minimalOptionsForBrowser);
		//  console.log("Minimal options user object:", JSON.stringify(minimalOptionsForBrowser.user, null, 2)); // Double-check user part

		try {
			regJSON = await startRegistration(options);
			// regJSON = await startRegistration({ publicKey: cleanOptions });
			console.log("startRegistration successful:", regJSON);
		} catch (regError) {
			if (regError.name === "InvalidStateError" || regError.name === "NotAllowedError") {
				throw new Error("Passkey registration cancelled or not supported by browser/authenticator.");
			}
			console.error("startRegistration error:", regError);
			throw new Error("Failed to initiate passkey creation.");
		}

		const verifyBody = {
			...regJSON, // Spread the WebAuthn response object
			username, // Add username from form
			email: emailFromInit, // Add email from form
			password, // Add password from form
			expectedChallenge, // Challenge from init-register response
			userId: userIdForRegistration, // User ID from init-register response
		};
		console.log("Calling verify-register with body:", verifyBody);

		const verifyResponse = await fetch(`${effectiveApiUrl}verify-register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(verifyBody),
			credentials: "include", // Keep if needed
		});

		const verifyData = await verifyResponse.json(); // Always try to parse JSON

		if (!verifyResponse.ok) {
			throw new Error(verifyData.error || `Registration verification failed (${verifyResponse.status})`);
		}

		if (verifyData.verified) {
			console.log("verify-register successful.");
			successMessage.textContent = `Successfully registered ${username}! You can now log in.`;
			showModalText(`Successfully registered ${username}!`);
			document.getElementById("username").value = "";
			document.getElementById("email").value = "";
			document.getElementById("password").value = "";
		} else {
			// This case might not happen if server throws error on failure, but handle defensively
			throw new Error(verifyData.error || "Registration failed after verification.");
		}
	} catch (error) {
		console.error("Registration error:", error);
		errorMessage.textContent = error.message || "An unknown registration error occurred.";
		showModalText(error.message || "An unknown registration error occurred."); // Show error in modal too
		throw error;
	}
}

// --- Login Function ---
async function login(username, password) {
	console.log("Login function called");
	const errorMessage = document.getElementById("errorMessage");
	const successMessage = document.getElementById("successMessage");

	// Store challenge and userId received from init-auth
	let expectedChallenge = null;
	let userIdForVerification = null;

	try {
		// wont work for netlify /N* gotta refactor l8
		// const effectiveApiUrl = SERVER_URL.endsWith("/") ? SERVER_URL : SERVER_URL + "/"; // Ensure trailing slash
		const effectiveApiUrl = SERVER_URL;

		console.log(`Calling init-auth for user: ${username}`);
		const initResponse = await fetch(`${effectiveApiUrl}init-auth`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ username, password }),
			credentials: "include",
		});
		const initData = await initResponse.json();
		console.log("initData:", initData);

		if (!initResponse.ok) {
			// Prioritize server error message
			throw new Error(initData.error || `Authentication initialization failed (${initResponse.status})`);
		}

		// Check if expected data is present
		if (!initData.options || !initData.challenge || !initData.userId) {
			console.error("Incomplete data received from init-auth:", initData);
			throw new Error("Server did not provide necessary data to start passkey login.");
		}

		const options = initData.options;
		// --- Add Detailed Logging ---
		console.log("Received options object:", JSON.stringify(options, null, 2));
		// if (options.user) {
		// 	console.log("Received options.user object:", JSON.stringify(options.user, null, 2));
		// 	if (typeof options.user.name === "undefined") {
		// 		console.error("CRITICAL: options.user.name is UNDEFINED in the object received from the server!");
		// 	} else {
		// 		console.log("options.user.name value:", options.user.name);
		// 	}
		// } else {
		// 	console.error("CRITICAL: options.user is MISSING in the object received from the server!");
		// }
		// --- End Detailed Logging ---
		/*	const cleanOptions = { ...options };
		// delete cleanOptions.hints;
		// delete cleanOptions.extensions;*/
		expectedChallenge = initData.challenge; // Store challenge
		userIdForVerification = initData.userId; // Store userId
		console.log(`init-auth successful. Challenge: ${expectedChallenge}, UserID: ${userIdForVerification}`);

		// 2. Start WebAuthn Authentication Ceremony
		let authJSON;
		try {
			authJSON = await startAuthentication(options);
			// authJSON = await startAuthentication({ publicKey: cleanOptions });
			console.log("startAuthentication successful:", authJSON);
		} catch (authError) {
			if (authError.name === "NotAllowedError") {
				throw new Error("Passkey authentication cancelled.");
			}
			console.error("startAuthentication error:", authError);
			throw new Error("Failed to initiate passkey usage.");
		}

		const verifyBody = {
			...authJSON, // Spread the WebAuthn response object
			expectedChallenge, // Add the challenge received from init-auth
			userId: userIdForVerification, // Add the userId received from init-auth
		};

		console.log("Calling verify-auth with body:", verifyBody);
		const verifyResponse = await fetch(`${effectiveApiUrl}verify-auth`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(verifyBody),
			credentials: "include",
		});

		const verifyData = await verifyResponse.json();

		if (!verifyResponse.ok) {
			throw new Error(verifyData.error || `Authentication verification failed (${verifyResponse.status})`);
		}

		if (verifyData.verified) {
			console.log("verify-auth successful.");
			const loggedInUsername = verifyData.username || username;
			successMessage.textContent = `Successfully logged in as ${loggedInUsername}!`;
			showModalText(`Successfully logged in as ${loggedInUsername}!`);
			// TODO: Redirect or update UI for logged-in state
			// window.location.reload(); // Example: Reload page
			document.getElementById("username").value = "";
			document.getElementById("password").value = "";
		} else {
			// This case might not happen if server throws error on failure
			throw new Error(verifyData.error || "Login failed after verification.");
		}
	} catch (error) {
		console.error("Login error:", error);
		errorMessage.textContent = error.message || "An unknown login error occurred.";
		showModalText(error.message || "An unknown login error occurred."); // Show error in modal
	}
}

// --- Utility to show modal ---
function showModalText(text) {
	if (modal && modal.querySelector) {
		const contentElement = modal.querySelector("[data-content]");
		if (contentElement) {
			contentElement.innerText = text;
		} else {
			console.error("Modal content element '[data-content]' not found.");
		}
		if (typeof modal.showModal === "function") {
			modal.showModal();
		} else {
			console.error("Modal element does not have a showModal method.");
		}
	} else {
		console.error("Modal element '[data-modal]' not found.");
		// Fallback alert if modal isn't working
		alert(text);
	}
}
