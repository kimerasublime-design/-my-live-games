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

		// Give the racing surface more vertical room so each horse has a
		// taller lane and the jockey's legs and all four hooves remain readable.
		const trackTop = H * 0.12;
		const trackBottom = H * 0.90;
		const trackHeight = trackBottom - trackTop;
		const laneH = trackHeight / laneCount;
		const isMobile = W <= 600;
		const trackLeft = isMobile ? Math.min(108, Math.max(94, W * 0.265)) : Math.min(280, Math.max(210, W * 0.18));
		const trackRight = W - (isMobile ? 8 : 18);
		const trackWidth = Math.max(80, trackRight - trackLeft);

		const dirt = ctx.createLinearGradient(trackLeft, trackTop, trackRight, trackBottom);
		dirt.addColorStop(0, "#c98550");
		dirt.addColorStop(0.48, "#a65d34");
		dirt.addColorStop(1, "#824328");
		ctx.fillStyle = "rgba(24, 17, 13, 0.82)";
		ctx.beginPath();
		if (typeof ctx.roundRect === "function") ctx.roundRect(trackLeft - 9, trackTop - 9, trackWidth + 18, trackHeight + 18, 13);
		else ctx.rect(trackLeft - 9, trackTop - 9, trackWidth + 18, trackHeight + 18);
		ctx.fill();
		ctx.fillStyle = dirt;
		ctx.fillRect(trackLeft, trackTop, trackWidth, trackHeight);

		// Dirt grain and hoof-worn streaks drift backward to reinforce speed.
		// The track geometry stays fixed; only the surface texture scrolls.
		const dirtScroll = (now * 0.035) % trackWidth;
		for (let i = 0; i < 125; i++) {
			const baseX = ((i * 73) % 997) / 997 * trackWidth;
			const px = trackLeft + ((baseX - dirtScroll + trackWidth) % trackWidth);
			const py = trackTop + ((i * 137) % 991) / 991 * trackHeight;
			ctx.strokeStyle = i % 3 === 0 ? "rgba(255,220,170,0.16)" : "rgba(52,25,13,0.15)";
			ctx.lineWidth = i % 4 === 0 ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(px, py);
			ctx.lineTo(px + 5 + (i % 9), py + ((i % 3) - 1));
			ctx.stroke();
		}

		state.lanes.forEach((lane, i) => {
			const y = trackTop + i * laneH;
			if (i % 2 === 0) {
				ctx.fillStyle = "rgba(255, 220, 180, 0.085)";
				ctx.fillRect(trackLeft, y, trackWidth, laneH);
			}
			if (i > 0) {
				ctx.strokeStyle = "rgba(255, 239, 215, 0.72)";
				ctx.lineWidth = 2;
				ctx.setLineDash([12, 9]);
				ctx.beginPath();
				ctx.moveTo(trackLeft + 2, y);
				ctx.lineTo(trackRight - 2, y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			const progress = Math.min(lane.distance / config.finishLine, 1);
			ctx.fillStyle = "rgba(255, 232, 190, 0.34)";
			ctx.fillRect(trackLeft + 2, y + laneH * 0.92, trackWidth - 4, Math.max(3, laneH * 0.022));
			ctx.fillStyle = lane.color + "D0";
			ctx.fillRect(trackLeft + 2, y + laneH * 0.92, (trackWidth - 4) * progress, Math.max(3, laneH * 0.022));

			// Larger proportional rendering: the earlier safety-margin setting
			// made the horse and jockey too small on phone screens.
			const spriteH = Math.min(laneH * (isMobile ? 0.91 : 0.92), isMobile ? 148 : 168);
			const spriteW = spriteH * 1.25;
			const horseX = trackLeft + spriteW / 2 + (trackWidth - spriteW) * progress;
			const horseY = y + laneH * 0.49;
			const frames = spriteSets.get(lane.horseId) || [];
			// Offset each horse's loop so all five do not gallop in sync.
			// The source order remains intact; only the starting phase differs.
			const frameOffset = Math.round(i * FRAME_COUNT / laneCount);
			const frameIndex = (Math.floor(now / FRAME_DURATION) + frameOffset) % FRAME_COUNT;
			const sprite = frames[frameIndex];

			// Soft moving contact shadow keeps the horse visually grounded
			// on the dirt lane without obscuring the legs or hooves.
			ctx.save();
			const shadowX = horseX - spriteW * 0.02;
			const shadowY = horseY + spriteH * 0.405;
			const shadowGradient = ctx.createRadialGradient(shadowX, shadowY, 2, shadowX, shadowY, spriteW * 0.34);
			shadowGradient.addColorStop(0, "rgba(28, 16, 10, 0.34)");
			shadowGradient.addColorStop(1, "rgba(28, 16, 10, 0)");
			ctx.fillStyle = shadowGradient;
			ctx.beginPath();
			ctx.ellipse(shadowX, shadowY, spriteW * 0.34, Math.max(4, laneH * 0.055), 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Small hoof-level dust plume follows each galloping horse.
			// The deterministic phase keeps the particles smooth without
			// creating random flicker or allocating particle objects per frame.
			const dustPhase = now * 0.006 + i * 1.73;
			const dustX = horseX - spriteW * 0.30;
			const dustY = horseY + spriteH * 0.29;
			ctx.save();
			for (let p = 0; p < 6; p++) {
				const phase = dustPhase + p * 1.05;
				const drift = (p * 13 + (now * 0.025) % 34);
				const px = dustX - drift;
				const py = dustY + Math.sin(phase) * (3 + p * 1.2);
				const radiusX = 3 + (p % 3) * 2;
				const radiusY = 1.8 + (p % 2) * 1.2;
				const alpha = 0.12 + (0.12 * (1 + Math.sin(phase)) / 2);
				ctx.fillStyle = `rgba(245, 207, 163, ${alpha})`;
				ctx.beginPath();
				ctx.ellipse(px, py, radiusX, radiusY, -0.12, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();

			if (sprite && sprite.complete && sprite.naturalWidth > 0) {
				ctx.save();
				ctx.shadowColor = "rgba(35, 18, 10, 0.42)";
				ctx.shadowBlur = 6;
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
		ctx.strokeStyle = "rgba(255, 246, 224, 0.92)";
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(trackLeft, trackTop);
		ctx.lineTo(trackRight, trackTop);
		ctx.moveTo(trackLeft, trackBottom);
		ctx.lineTo(trackRight, trackBottom);
		ctx.stroke();
		ctx.strokeStyle = "rgba(73, 37, 20, 0.78)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(trackLeft, trackTop + 7);
		ctx.lineTo(trackRight, trackTop + 7);
		ctx.moveTo(trackLeft, trackBottom - 7);
		ctx.lineTo(trackRight, trackBottom - 7);
		ctx.stroke();

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
