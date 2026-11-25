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
					`<span class="lane-vote">VOTO ${lane.number}</span>` +
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

		// Track surface: opaque dirt with transparent space outside for OBS overlays.
		const trackTop = H * 0.14;
		const trackBottom = H * 0.88;
		const trackHeight = trackBottom - trackTop;
		const laneH = trackHeight / laneCount;
		const isMobile = W <= 600;
		// Reserve a slim column for the lane badges on phones, without letting
		// the badges cover the horse sprites. Desktop keeps the wider HUD gutter.
		const trackLeft = isMobile ? Math.min(116, Math.max(104, W * 0.28)) : Math.min(300, Math.max(220, W * 0.19));
		const trackRight = W - (isMobile ? 10 : 18);
		const trackWidth = Math.max(80, trackRight - trackLeft);

		const dirt = ctx.createLinearGradient(trackLeft, trackTop, trackRight, trackBottom);
		dirt.addColorStop(0, "#b87543");
		dirt.addColorStop(0.48, "#99552f");
		dirt.addColorStop(1, "#774027");
		ctx.fillStyle = "rgba(24, 17, 13, 0.72)";
		ctx.beginPath();
		if (typeof ctx.roundRect === "function") ctx.roundRect(trackLeft - 9, trackTop - 9, trackWidth + 18, trackHeight + 18, 13);
		else ctx.rect(trackLeft - 9, trackTop - 9, trackWidth + 18, trackHeight + 18);
		ctx.fill();
		ctx.fillStyle = dirt;
		ctx.fillRect(trackLeft, trackTop, trackWidth, trackHeight);

		// Stable dirt grain and hoof-worn streaks (not randomized per frame).
		for (let i = 0; i < 105; i++) {
			const px = trackLeft + ((i * 73) % 997) / 997 * trackWidth;
			const py = trackTop + ((i * 137) % 991) / 991 * trackHeight;
			ctx.strokeStyle = i % 3 === 0 ? "rgba(255,220,170,0.13)" : "rgba(52,25,13,0.12)";
			ctx.lineWidth = i % 4 === 0 ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(px, py);
			ctx.lineTo(px + 5 + (i % 9), py + ((i % 3) - 1));
			ctx.stroke();
		}

		// Five clearly separated racing lanes.
		state.lanes.forEach((lane, i) => {
			const y = trackTop + i * laneH;
			if (i % 2 === 0) {
				ctx.fillStyle = "rgba(255, 220, 180, 0.075)";
				ctx.fillRect(trackLeft, y, trackWidth, laneH);
			}
			if (i > 0) {
				ctx.strokeStyle = "rgba(255, 239, 215, 0.62)";
				ctx.lineWidth = 2;
				ctx.setLineDash([12, 9]);
				ctx.beginPath();
				ctx.moveTo(trackLeft + 2, y);
				ctx.lineTo(trackRight - 2, y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Lane progress marker.
			const progress = Math.min(lane.distance / config.finishLine, 1);
			ctx.fillStyle = "rgba(255, 232, 190, 0.28)";
			ctx.fillRect(trackLeft + 2, y + laneH * 0.91, trackWidth - 4, Math.max(2, laneH * 0.018));
			ctx.fillStyle = lane.color + "B0";
			ctx.fillRect(trackLeft + 2, y + laneH * 0.91, (trackWidth - 4) * progress, Math.max(2, laneH * 0.018));

			// Keep the complete 320×256 sprite visible; a slightly larger draw size
			// makes the horse's four legs and the jockey's lower legs readable on phones.
			const spriteH = Math.min(laneH * (isMobile ? 0.94 : 1.02), isMobile ? 142 : 166);
			const spriteW = spriteH * 1.25;
			const horseX = trackLeft + spriteW / 2 + (trackWidth - spriteW) * progress;
			const horseY = y + laneH * 0.48;
			const frames = spriteSets.get(lane.horseId) || [];
			const frameIndex = Math.floor(now / FRAME_DURATION) % FRAME_COUNT;
			const sprite = frames[frameIndex];

			if (sprite && sprite.complete && sprite.naturalWidth > 0) {
				ctx.save();
				ctx.shadowColor = "rgba(35, 18, 10, 0.38)";
				ctx.shadowBlur = 5;
				ctx.shadowOffsetY = 3;
				ctx.drawImage(sprite, horseX - spriteW / 2, horseY - spriteH / 2, spriteW, spriteH);
				ctx.restore();
			} else {
				ctx.font = `bold ${Math.max(34, Math.round(laneH * 0.48))}px serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("🐎", horseX, horseY);
			}
		});

		// Inner and outer safety rails.
		ctx.strokeStyle = "rgba(255, 246, 224, 0.88)";
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(trackLeft, trackTop);
		ctx.lineTo(trackRight, trackTop);
		ctx.moveTo(trackLeft, trackBottom);
		ctx.lineTo(trackRight, trackBottom);
		ctx.stroke();
		ctx.strokeStyle = "rgba(73, 37, 20, 0.72)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(trackLeft, trackTop + 7);
		ctx.lineTo(trackRight, trackTop + 7);
		ctx.moveTo(trackLeft, trackBottom - 7);
		ctx.lineTo(trackRight, trackBottom - 7);
		ctx.stroke();

		// High-contrast checker finish marker.
		const checkerSize = Math.max(9, Math.min(16, laneH / 8));
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 2; col++) {
				ctx.fillStyle = (row + col) % 2 === 0 ? "#fff" : "#202020";
				ctx.fillRect(trackRight - checkerSize * 2 + col * checkerSize,
					trackTop + row * (trackHeight / 8), checkerSize, trackHeight / 8 + 1);
			}
		}
		ctx.fillStyle = "#fff0c9";
		ctx.font = "bold 12px sans-serif";
		ctx.textAlign = "right";
		ctx.fillText("CHEGADA", trackRight - 4, trackTop - 14);
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
