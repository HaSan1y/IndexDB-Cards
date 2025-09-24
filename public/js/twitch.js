let player;

function loadScript(src, callback) {
	let script = document.createElement("script");
	script.src = src;
	script.onload = callback;
	document.head.appendChild(script);
}

loadScript("https://player.twitch.tv/js/embed/v1.js", function () {
	let x = "trumpvsbiden2028";
	var options = {
		width: 400,
		height: 200,
		channel: x,
		theme: "dark",
		layout: "video",
		muted: false,
		autoplay: false, // Set to true if you want the video to autoplay
		parent: [location.hostname, "localhost", "db-2-cards.vercel.app", "elegant-bubblegum-a62895.netlify.app"],
		quality: "low",
		setChannel: x,
		arguments: [x],
		// Set the channel to the initial value of x
	};

	if (typeof Twitch !== "undefined") {
		initPlayer();
	} else {
		console.error("Twitch API not loaded");
		document.addEventListener("DOMContentLoaded", initPlayer);
	}

	function initPlayer() {
		player = new Twitch.Player("twitch-embed", options);
		setupEventListeners();
		updateChannelName(); // Initial call to set the correct value
	}

	function setupEventListeners() {
		document.getElementById("buttonx").addEventListener("change", xx);
		document.querySelectorAll('input[name="hopping"]').forEach((radio) => {
			radio.addEventListener("change", updateChannelName);
		});
	}

	function xx() {
		let buttonElement = document.getElementById("buttonx");
		x = buttonElement.value;
		setChannel(x);
	}

	function setChannel(channel) {
		try {
			player.setChannel(channel);
		} catch (error) {
			console.error("Error setting channel:", error);
		}
	}

	function updateChannelName() {
		const buttonx = document.getElementById("buttonx");
		const selectedRadio = document.querySelector('input[name="hopping"]:checked');

		switch (selectedRadio.value) {
			case "c":
				buttonx.value = "cerbervt";
				break;
			case "p":
				buttonx.value = "kitboga";
				break;
			case "tb":
				buttonx.value = "thinkerbella";
				break;
			case "y":
				buttonx.value = "yugioh_official";
				break;
			case "s":
				buttonx.value = "shonzo";
				break;
			case "t":
				buttonx.value = "trumpvsbiden2028";
				break;
		}

		setChannel(buttonx.value);
	}
});
/*let twitchScriptLoaded = false;
let player = null;

function loadTwitchScript(callback) {
    if (twitchScriptLoaded) {
        callback();
        return;
    }
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.onload = () => {
        twitchScriptLoaded = true;
        callback();
    };
    document.head.appendChild(script);
}

const checkbox = document.getElementById("twitch-toggle");
const embedContainer = document.getElementById("embed-responsive");

checkbox.addEventListener("change", () => {
    // Remove old embed if present
    embedContainer.innerHTML = "";

    if (checkbox.checked) {
        loadTwitchScript(() => {
            // Create a div for the player
            const playerDiv = document.createElement("div");
            playerDiv.id = "twitch-embed";
            embedContainer.appendChild(playerDiv);

            // Create the Twitch player
            player = new Twitch.Player("twitch-embed", {
                width: "100%",
                height: 300,
                channel: "trumporbiden2028",
                parent: [location.hostname, "localhost", "db-2-cards.vercel.app", "elegant-bubblegum-a62895.netlify.app"]
            });

            player.addEventListener(Twitch.Player.READY, () => {
                // Set to lowest quality available
                const qualities = player.getQualities();
                if (qualities && qualities.length) {
                    player.setQuality(qualities[qualities.length - 1].group);
                }
                player.setMuted(false); // Will only work if browser allows
            });
        });
    }
});

*/
// twitch delete

document.addEventListener("DOMContentLoaded", () => {
	const delbox = document.querySelector("#delboxx");
	if (!delbox) return;

	delbox.addEventListener("change", () => {
		const twContainer = document.getElementById("embedholders");
		const oldEmbed = document.getElementById("twitch-embed");
		if (oldEmbed) {
			return oldEmbed.remove();
		}

		if (delbox.checked) {
			const twitchEmbed = document.createElement("div");
			twitchEmbed.id = "twitch-embed";
			twContainer.appendChild(twitchEmbed);

			new Twitch.Embed("twitch-embed", {
				width: 480,
				height: 260,
				theme: "dark",
				channel: "trumporbiden2028",
				layout: "video",
				//autoplay: true,
				muted: false,
				parent: [location.hostname, "localhost", "db-2-cards.vercel.app", "elegant-bubblegum-a62895.netlify.app"],
				quality: "low",
			});
		}
	});
});
