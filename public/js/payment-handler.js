console.log("Payment Handler script loaded.");

document.addEventListener("DOMContentLoaded", () => {
	const confirmButton = document.getElementById("confirm-payment");
	const cancelButton = document.getElementById("cancel-payment");
	const merchantOriginEl = document.getElementById("merchant-origin");
	const paymentTotalEl = document.getElementById("payment-total");
	const methodDataEl = document.getElementById("method-data");
	const statusEl = document.getElementById("status");
	const errorEl = document.getElementById("error-message");

	const urlParams = new URLSearchParams(window.location.search);
	const origin = urlParams.get("origin");
	const totalString = urlParams.get("total");
	const methodDataString = urlParams.get("methodData");
	const paymentRequestId = urlParams.get("paymentRequestId");
	let parsedMethodData = [];

	console.log("Origin:", origin);
	console.log("Total String:", totalString);
	console.log("Method Data String:", methodDataString);
	console.log("Payment Request ID:", paymentRequestId);

	merchantOriginEl.textContent = origin || "Unknown merchant";

	try {
		const total = totalString ? JSON.parse(totalString) : null;
		paymentTotalEl.textContent = total?.value && total?.currency
			? `${total.value} ${total.currency}`
			: "Not provided";
	} catch (e) {
		paymentTotalEl.textContent = "Could not read total";
		console.error("Error parsing total:", e);
	}

	try {
		parsedMethodData = methodDataString ? JSON.parse(methodDataString) : [];
		methodDataEl.textContent = parsedMethodData.length
			? JSON.stringify(parsedMethodData, null, 2)
			: "No method data provided.";
	} catch (e) {
		methodDataEl.textContent = "Could not read method data.";
		console.error("Error parsing method data:", e);
	}

	const setBusy = (busy) => {
		confirmButton.disabled = busy;
		cancelButton.disabled = busy;
	};

	const sendResponseToServiceWorker = (payload) => {
		if (navigator.serviceWorker?.controller) {
			console.log("Sending message to Service Worker:", payload);
			navigator.serviceWorker.controller.postMessage({
				type: "paymentResponse",
				payload,
			});
			return true;
		}

		console.warn("No active service worker controller found.");
		errorEl.textContent = "Payment was simulated, but no active Service Worker is controlling this page.";
		return false;
	};

	confirmButton.addEventListener("click", async () => {
		statusEl.textContent = "Processing payment...";
		setBusy(true);
		errorEl.textContent = "";

		try {
			await new Promise((resolve) => setTimeout(resolve, 900));
			const paymentGatewayResponse = {
				transactionId: `txn_${Date.now()}`,
				paymentRequestId: paymentRequestId || null,
				status: "success",
				timestamp: new Date().toISOString(),
			};

			const paymentResponsePayload = {
				methodName: parsedMethodData[0]?.supportedMethods || "demo-payment-method",
				details: paymentGatewayResponse,
			};

			statusEl.textContent = "Payment successful.";
			sendResponseToServiceWorker(paymentResponsePayload);
		} catch (paymentError) {
			console.error("Payment processing failed:", paymentError);
			errorEl.textContent = `Payment failed: ${paymentError.message}`;
			statusEl.textContent = "Payment failed.";
		} finally {
			setBusy(false);
		}
	});

	cancelButton.addEventListener("click", () => {
		statusEl.textContent = "Payment cancelled.";
		console.log("Payment cancelled by user.");

		if (!window.close()) {
			errorEl.textContent = "You can close this tab when you are ready.";
		}
	});
});
