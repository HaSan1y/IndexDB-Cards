//const fetch = require("node-fetch");

module.exports = async function getData(type) {
	//console.log(`Incoming ${type} request`);
	try {
		if (type === "joke" || type === "jokes") {
			const response = await fetch("https://www.yomama-jokes.com/api/random");
			const text = await response.text();
			return { joke: text };
		} else if (type === "insult" || type === "insults") {
			// const response = await fetch("https://evilinsult.com/api/insult");
			const response = await fetch("https://evilinsult.com/generate_insult.php?lang=en&type=json");
			const data = await response.text();
			return { insult: data };
		} else if (type === "image") {
			const response = await fetch(`https://picsum.photos/200/300?random=${Date.now()}`);
			const arrayBuffer = await response.arrayBuffer();
			return {
				buffer: Buffer.from(arrayBuffer),
				contentType: response.headers.get("content-type") || "image/jpeg",
			};
		} else {
			throw new Error("Unknown type");
		}
	} catch (error) {
		console.error("Error fetching data:", error);
		throw error;
	}
};