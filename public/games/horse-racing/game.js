/**
 * game.js
 * Kimera Live Games — five-lane horse race renderer.
 * Loads the V4 transparent PNG gallop frames for each horse.
 */
(() => {
	"use strict";

	const config = window.RACE_CONFIG;
	const engine = new RaceEngine(config);
	const canvas = document.getElementById("raceCanvas");
	const ctx = canvas.getContext("2d");

	const phaseBanner = document.getElementById("phaseBanner");
	const phaseText = document.getElementById("phaseText");
	const phaseTimer = document.getElementById("phaseTimer");
	const laneLabelsDiv = document.getElementById("laneLabels");
	const eventFeedDiv = document.getElementById("eventFeed");
	const winnerOverlay = document.getElementById("winnerOverlay");
	const winnerEmoji = document.getElementById("winnerEmoji");
	const winnerName = document.getElementById("winnerName");
	const winnerSupporters = document.getElementById("winnerSupporters");

	const FRAME_COUNT = 8;
	const FRAME_DURATION = config.spriteFrameDuration || 110;
	const spriteSets = new Map();

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(window.innerWidth * dpr);
		canvas.height = Math.round(window.innerHeight * dpr);
		canvas.style.width = window.innerWidth + "px";
		canvas.style.height = window.innerHeight + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	window.addEventListener("resize", resize);
	resize();

	function loadHorseSprites() {
		config.lanes.forEach((lane) => {
			const frames = [];
			for (let i = 1; i <= FRAME_COUNT; i++) {
				const image = new Image();
				image.decoding = "async";
				image.src = `assets/horses/${lane.horseId}/frame-${String(i).padStart(2, "0")}.png`;
				frames.push(image);
			}
			spriteSets.set(lane.horseId, frames);
		});
	}
	loadHorseSprites();

	TikTokBridge.on("gift", (data) => engine.handleGift(data));
	TikTokBridge.on("chat", (data) => engine.handleChat(data));
	TikTokBridge.on("like", (data) => engine.handleLike(data));

	function buildLaneLabels() {
		laneLabelsDiv.innerHTML = "";
		config.lanes.forEach((lane) => {
			const el = document.createElement("div");
			el.className = "lane-label";
			el.id = `lane-label-${lane.id}`;
			el.style.borderLeftColor = lane.color;
			const giftEmojis = config.getLaneGiftEmojis(lane.id).join(" ");
			el.innerHTML =
				`<div class="lane-top">` +
					`<span class="lane-flag" aria-hidden="true">${lane.number}</span>` +
					`<span class="lane-name">${lane.name}</span>` +
					`<span class="lane-vote">VOTE ${lane.number}</span>` +
					`<span class="lane-dist">0%</span>` +
					`</div>` +
					`<div class="lane-detail">${lane.detail}</div>` +
					`<div class="lane-gifts">${giftEmojis}</div>`;
			laneLabelsDiv.appendChild(el);
		});
	}
	buildLaneLabels();

	engine.on("phaseChange", ({ phase }) => {
		if (phase === "waiting") buildLaneLabels();
	});

	let lastFeedSignature = "";
	function frame(now) {
		const state = engine.tick();
		drawTrack(state, now || performance.now());
		updateHUD(state);
		requestAnimationFrame(frame);
	}

	function drawTrack(state, now) {
		const W = window.innerWidth;
		const H = window.innerHeight;
		const laneCount = state.lanes.length;
		ctx.clearRect(0, 0, W, H);

		const trackTop = H * 0.14;
		const trackBottom = H * 0.88;
		const trackHeight = trackBottom - trackTop;
		const laneH = trackHeight / laneCount;
		const trackLeft = Math.min(300, Math.max(220, W * 0.19));
		const trackRight = W - 35;
		const trackWidth = Math.max(80, trackRight - trackLeft);

		ctx.fillStyle = "rgba(22, 14, 10, 0.48)";
		ctx.beginPath();
		ctx.roundRect(trackLeft - 8, trackTop - 8, trackWidth + 16, trackHeight + 16, 12);
		ctx.fill();

		state.lanes.forEach((lane, i) => {
			const y = trackTop + i * laneH;
			if (i % 2 === 0) {
				ctx.fillStyle = "rgba(255,255,255,0.045)";
				ctx.fillRect(trackLeft, y, trackWidth, laneH);
			}
			if (i > 0) {
				ctx.strokeStyle = "rgba(255,255,255,0.22)";
				ctx.lineWidth = 1;
				ctx.setLineDash([9, 7]);
				ctx.beginPath();
				ctx.moveTo(trackLeft, y);
				ctx.lineTo(trackRight, y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			const progress = Math.min(lane.distance / config.finishLine, 1);
			ctx.fillStyle = lane.color + "45";
			ctx.fillRect(trackLeft, y + laneH * 0.78, trackWidth * progress, Math.max(3, laneH * 0.055));

			const spriteH = Math.min(laneH * 0.91, 142);
			const spriteW = spriteH * 1.25;
			const horseX = trackLeft + spriteW / 2 + (trackWidth - spriteW) * progress;
			const horseY = y + laneH * 0.47;
			const frames = spriteSets.get(lane.horseId) || [];
			const frameIndex = Math.floor(now / FRAME_DURATION) % FRAME_COUNT;
			const sprite = frames[frameIndex];

			if (sprite && sprite.complete && sprite.naturalWidth > 0) {
				ctx.drawImage(sprite, horseX - spriteW / 2, horseY - spriteH / 2, spriteW, spriteH);
			} else {
				ctx.font = `bold ${Math.max(34, Math.round(laneH * 0.48))}px serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("🐎", horseX, horseY);
			}
		});

		ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
		ctx.lineWidth = 3;
		ctx.setLineDash([12, 6]);
		ctx.beginPath();
		ctx.moveTo(trackRight, trackTop - 5);
		ctx.lineTo(trackRight, trackBottom + 5);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = "#ffd700";
		ctx.font = "bold 14px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("🏁 CHEGADA", trackRight - 4, trackTop - 14);
	}

	function updateHUD(state) {
		const phaseLabels = {
			waiting: "🏇 Aguardando votos e presentes...",
			countdown: "⏳ Corrida começa em...",
			racing: "🏁 CORRIDA EM ANDAMENTO!",
			finished: "🏆 CORRIDA FINALIZADA!",
			cooldown: "⏳ Próxima corrida em instantes...",
		};
		phaseText.textContent = phaseLabels[state.phase] || state.phase;
		const remaining = engine.phaseRemaining();
		phaseTimer.textContent = remaining !== Infinity && remaining > 0 ? Math.ceil(remaining / 1000) + "s" : "";
		phaseBanner.classList.toggle("countdown", state.phase === "countdown");

		state.lanes.forEach((lane) => {
			const el = document.getElementById(`lane-label-${lane.id}`);
			if (el) el.querySelector(".lane-dist").textContent =
				Math.round((lane.distance / config.finishLine) * 100) + "%";
		});

		const signature = state.recentEvents.map((evt) => evt.timestamp).join(",");
		if (signature !== lastFeedSignature) {
			lastFeedSignature = signature;
			renderFeed(state.recentEvents.slice(0, 8));
		}

		if (state.phase === "finished" && state.winner) showWinner(state.winner);
		else winnerOverlay.classList.add("hidden");
	}

	function renderFeed(events) {
		eventFeedDiv.innerHTML = "";
		events.forEach((evt) => {
			const el = document.createElement("div");
			el.className = "feed-item " + evt.type;
			if (evt.type === "gift") {
				el.textContent = `${evt.giftEmoji} ${evt.nickname} → ${evt.laneName} (+${evt.distance})`;
			} else if (evt.type === "vote") {
				el.textContent = `💬 ${evt.nickname} → ${evt.laneName} (+${evt.distance})`;
			} else if (evt.type === "chat") {
				el.textContent = `💬 ${evt.nickname}: ${evt.text}`;
			} else if (evt.type === "like") {
				el.textContent = `❤️ ${evt.nickname} +${evt.count}`;
			}
			eventFeedDiv.appendChild(el);
		});
	}

	function showWinner(winner) {
		winnerOverlay.classList.remove("hidden");
		winnerEmoji.textContent = "🏆";
		winnerName.textContent = winner.name + " VENCEU!";
		winnerName.style.color = winner.color;
		const supporters = Array.from(winner.supporters.values())
			.sort((a, b) => b.totalContrib - a.totalContrib)
			.slice(0, 3);
		winnerSupporters.textContent = supporters.length
			? "Maiores apoiadores: " + supporters.map((s) => `${s.nickname} (${s.totalContrib})`).join(", ")
			: "";
	}

	requestAnimationFrame(frame);
	console.log("[KimeraHorseRacing] Five horse sprite lanes initialized.");
})();
