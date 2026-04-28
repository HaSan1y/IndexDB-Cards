// class CountsessionStorage {
// 	constructor() {
// 		this.displayedCardIds = new Set();
// 		this.solution = [];
// 		this.sentence = [];
// 	}
// }
// const sesCount = new CountsessionStorage();

function getStorage() {
	// Access the explicitly global variable set in script.js
	return window.currentStorageType === "local" ? localStorage : sessionStorage;
}

let cardIdCounter = 0;
let sessionData = {
	// Renamed to avoid conflict if 'data' is used elsewhere
	sentences: [],
	solutions: [],
};

// Function to create a new card
function createCardsl(id, sentence, solution) {
	const card = {
		id,
		sentence,
		solution,
	};
	sessionData.sentences.push(card);
	getStorage().setItem("sessionCardData", JSON.stringify(sessionData));
}

// Function to read all cards
function readCards() {
	const storedData = getStorage().getItem("sessionCardData");
	if (storedData) {
		let sessionData;
		try {
			sessionData = JSON.parse(storedData);
		} catch (error) {
			console.error("Error parsing session data:", error);
			sessionData = {
				sentences: [],
				solutions: [],
			};
		}
		return sessionData.sentences || [];
	} else {
		return [];
	}
}

// Function to update a card
function updateCard(id, sentence, solution) {
	const cardIndex = sessionData.sentences.findIndex((card) => card.id === id);
	if (cardIndex !== -1) {
		sessionData.sentences[cardIndex].sentence = sentence;
		sessionData.sentences[cardIndex].solution = solution;
		getStorage().setItem("sessionCardData", JSON.stringify(sessionData));
	}
}

// const settings = { theme: "light" };

async function handleSessionSubmit(event) {
	event.preventDefault();
	const [s1, s2, s3] = [document.getElementById("s1").value, document.getElementById("s2").value, document.getElementById("s3").value];
	const sentence = [s1, s2].filter(Boolean);
	const solution = [s3].filter(Boolean);

	try {
		// Ensure cardIdCounter is up-to-date if page was reloaded
		const existingCards = readCards();
		cardIdCounter = existingCards.length > 0 ? Math.max(...existingCards.map((c) => c.id)) + 1 : 0;

		const cardId = cardIdCounter++;
		createCardsl(cardId, sentence, solution);
		// Reread cards after creation and display all
		displaysesCards();
	} catch (error) {
		console.error("Error displaying cards:", error);
	}
}
function displaysesCards() {
	// No longer needs parameters
	const cardHolder = document.getElementById("cardHolder");
	cardHolder.innerHTML = "";
	const cards = readCards(); // Read the current cards from getStorage()
	cards.forEach((card) => {
		const cardElement = createsesCard(card); // Pass the whole card object
		cardHolder.appendChild(cardElement);
	});
}

function createsesInnerCard(sentence, solution) {
	const frontSide = createsesFrontSide(sentence);
	const backSide = createsesBackSide(solution);
	return { frontSide, backSide };
}

function createsesCard(cardData) {
	// Accept the full card object
	const card = document.createElement("div");
	card.classList.add("myCard");
	card.id = `card-${cardData.id}`; // Use the ID from the card data
	const innerCard = document.createElement("div");
	innerCard.classList.add("innerCard");
	// const cardsCreation = createsesInnerCard(sentences, solution);
	// const { frontSide, backSide } = cardsCreation;
	const frontSide = createsesFrontSide(cardData.sentence);
	const backSide = createsesBackSide(cardData.solution);
	innerCard.appendChild(frontSide);
	innerCard.appendChild(backSide);
	card.appendChild(innerCard);
	// card.addEventListener("click", () => {
	// 	togglesesCardContentdb(card, solution);
	// });
	return card;
}

function createsesFrontSide(sentence) {
	const frontSide = document.createElement("div");
	frontSide.classList.add("frontSide");

	const title = document.createElement("h2");
	title.classList.add("title");
	title.textContent = sentence[0] ? sentence[0] : "";

	const subtitle = document.createElement("p");
	subtitle.textContent = sentence[1] ? sentence[1] : "";

	frontSide.appendChild(title);
	frontSide.appendChild(subtitle);
	return frontSide;
}

function createsesBackSide(solution) {
	const backSide = document.createElement("div");
	backSide.classList.add("backSide");

	const head = document.createElement("h2");
	head.classList.add("backHead");
	head.textContent = solution[0] ? solution[0] : "";

	backSide.appendChild(head);
	const deleteButton = createsesDeleteButton();
	backSide.appendChild(deleteButton);
	return backSide;
}

function createsesDeleteButton() {
	const deleteButton = document.createElement("button");
	deleteButton.textContent = "Delete";
	deleteButton.classList.add("removebtn");
	deleteButton.onclick = (event) => {
		const cardElement = event.target.closest(".myCard");
		const cardIdNumeric = parseInt(cardElement.id.replace("card-", ""), 10);
		deleteCard(cardIdNumeric);
	};
	return deleteButton;
}
// Function to delete a card
function deleteCard(id) {
	const cardIndex = sessionData.sentences.findIndex((card) => card.id === id);
	if (cardIndex !== -1) {
		sessionData.sentences.splice(cardIndex, 1);
		getStorage().setItem("sessionCardData", JSON.stringify(sessionData));
		const cardElement = document.getElementById(`card-${id}`); // Find element by correct ID format
		if (cardElement) {
			cardElement.remove();
		}
	}
}

// Use sessionStorage for production
// sessionStorage.setItem("settings", JSON.stringify(settings));
// let value = JSON.parse(sessionStorage.getItem("settings"));
// sessionStorage.removeItem("key");
// sessionStorage.clear();
