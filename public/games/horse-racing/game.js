/**
 * game.js
 * Horse Racing — Canvas renderer + TikTokBridge wiring.
 * Reads state from RaceEngine, draws track + horses on Canvas,
 * updates DOM HUD elements (flags, gift legend, event feed).
 *
 * @module games/horse-racing/game
 */

(() => {
	// ==========================================
	// SETUP
	// ==========================================
	const config = window.RACE_CONFIG;
	const engine = new RaceEngine(config);

	const canvas = document.getElementById("raceCanvas");
	const ctx = canvas.getContext("2d");

	// DOM HUD elements
	const phaseBanner = document.getElementById("phaseBanner");
	const phaseText = document.getElementById("phaseText");
	const phaseTimer = document.getElementById("phaseTimer");
	const laneLabelsDiv = document.getElementById("laneLabels");
	const eventFeedDiv = document.getElementById("eventFeed");
	const winnerOverlay = document.getElementById("winnerOverlay");
	const winnerEmoji = document.getElementById("winnerEmoji");
	const winnerName = document.getElementById("winnerName");
	const winnerSupporters = document.getElementById("winnerSupporters");

	// ==========================================
	// CANVAS SIZING
	// ==========================================
	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	window.addEventListener("resize", resize);
	resize();

	// ==========================================
	// BRIDGE → ENGINE WIRING
	// ==========================================
	// Demo mode offers manual controls so the original game can be
	// explored without a TikTok Live connection.
	const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
	if (demoMode) {
		const badge = document.createElement("div");
		badge.textContent = "ORIGINAL VERSION · INTERACTIVE DEMO";
		badge.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:30;padding:8px 14px;border-radius:20px;background:#111;color:#fff;font:600 11px sans-serif;letter-spacing:.06em;border:1px solid rgba(255,255,255,.35);pointer-events:none";
		document.body.appendChild(badge);

		const controls = document.createElement("section");
		controls.id = "demoControls";
		controls.innerHTML = `
			<div class="demo-controls-head">
				<strong>🎮 DEMO CONTROLS</strong>
				<span id="demoModeStatus">Manual mode</span>
			</div>
			<div class="demo-lane-buttons" id="demoLaneButtons"></div>
			<div class="demo-action-buttons">
				<button type="button" id="demoAutoBtn">▶ Auto play</button>
				<button type="button" id="demoLikeBtn">❤️ Send likes</button>
				<button type="button" id="demoResetBtn">↻ Restart race</button>
			</div>
			<p>Tap a lane to send a gift, or vote using its number.</p>
		`;
		document.body.appendChild(controls);

		const laneButtons = controls.querySelector("#demoLaneButtons");
		config.lanes.forEach((lane, index) => {
			const group = document.createElement("div");
			group.className = "demo-lane-group";
			const giftButton = document.createElement("button");
			giftButton.type = "button";
			giftButton.className = "demo-lane-button";
			giftButton.style.setProperty("--lane-color", lane.color);
			giftButton.innerHTML = `<span>${lane.flag} ${lane.name}</span><small>🎁 Send gift</small>`;
			giftButton.addEventListener("click", () => sendDemoGift(index));
			const voteButton = document.createElement("button");
			voteButton.type = "button";
			voteButton.className = "demo-vote-button";
			voteButton.textContent = `💬 Vote ${index + 1}`;
			voteButton.addEventListener("click", () => sendDemoVote(index));
			group.append(giftButton, voteButton);
			laneButtons.appendChild(group);
		});

		function demoUser(laneIndex) {
			return { uniqueId: "preview-viewer-" + laneIndex, nickname: "Preview Viewer " + (laneIndex + 1) };
		}

		function sendDemoGift(laneIndex) {
			if (engine.state.phase === "finished" || engine.state.phase === "cooldown") return;
			const tier = config.giftTiers[config.giftTiers.length - 1];
			const gift = tier.gifts[laneIndex];
			engine.handleGift({
				giftName: gift.name,
				giftId: laneIndex,
				giftValue: tier.coins,
				user: demoUser(laneIndex),
			});
		}

		function sendDemoVote(laneIndex) {
			if (engine.state.phase === "finished" || engine.state.phase === "cooldown") return;
			engine.handleChat({
				user: demoUser(laneIndex),
				comment: String(laneIndex + 1),
			});
		}

		let autoTimer = null;
		let autoIndex = 0;
		const autoButton = controls.querySelector("#demoAutoBtn");
		const modeStatus = controls.querySelector("#demoModeStatus");
		autoButton.addEventListener("click", () => {
			if (autoTimer) {
				window.clearInterval(autoTimer);
				autoTimer = null;
				autoButton.textContent = "▶ Auto play";
				modeStatus.textContent = "Manual mode";
				return;
			}
			autoTimer = window.setInterval(() => {
				if (engine.state.phase === "finished" || engine.state.phase === "cooldown") return;
				sendDemoGift(autoIndex % config.lanes.length);
				autoIndex++;
			}, 900);
			autoButton.textContent = "Ⅱ Pause auto";
			modeStatus.textContent = "Auto play active";
		});

		controls.querySelector("#demoLikeBtn").addEventListener("click", () => {
			engine.handleLike({ user: { uniqueId: "preview-liker", nickname: "Preview Viewer" }, likeCount: 25 });
		});
		controls.querySelector("#demoResetBtn").addEventListener("click", () => {
			if (autoTimer) window.clearInterval(autoTimer);
			autoTimer = null;
			autoIndex = 0;
			autoButton.textContent = "▶ Auto play";
			modeStatus.textContent = "Manual mode";
			engine.reset();
		});
	} else {
		TikTokBridge.on("gift", (data) => engine.handleGift(data));
		TikTokBridge.on("chat", (data) => engine.handleChat(data));
		TikTokBridge.on("like", (data) => engine.handleLike(data));
	}

	// ==========================================
	// BUILD LANE LABELS (with gift legend)
	// ==========================================
	function buildLaneLabels() {
		laneLabelsDiv.innerHTML = "";
		config.lanes.forEach((lane) => {
			const el = document.createElement("div");
			el.className = "lane-label";
			el.id = `lane-label-${lane.id}`;
			el.style.borderLeftColor = lane.color;

			// Get gift emojis for this lane across all tiers
			const giftEmojis = config.getLaneGiftEmojis(lane.id).join(" ");
			const voteNum = lane.id + 1; // 1-indexed for viewers

			el.innerHTML =
				`<div class="lane-top">` +
				`<span class="lane-flag">${lane.flag}</span> ` +
				`<span class="lane-name">${lane.name}</span> ` +
				`<span class="lane-vote">Type ${voteNum}</span>` +
				`<span class="lane-dist">0%</span>` +
				`</div>` +
				`<div class="lane-gifts">${giftEmojis}</div>`;
			laneLabelsDiv.appendChild(el);
		});
	}
	buildLaneLabels();

	// Rebuild lane labels on reset (flags might re-render)
	engine.on("phaseChange", ({ phase }) => {
		if (phase === "waiting") buildLaneLabels();
	});

	// ==========================================
	// RENDER LOOP
	// ==========================================
	let lastFeedCount = 0;

	function frame() {
		const state = engine.tick();
		drawTrack(state);
		updateHUD(state);
		requestAnimationFrame(frame);
	}

	// ==========================================
	// CANVAS DRAWING
	// ==========================================
	function drawTrack(state) {
		const W = canvas.width;
		const H = canvas.height;
		const laneCount = state.lanes.length;

		// Clear
		ctx.clearRect(0, 0, W, H);

		// Track dimensions
		const trackTop = H * 0.15;
		const trackBottom = H * 0.85;
		const trackHeight = trackBottom - trackTop;
		const laneH = trackHeight / laneCount;
		const trackLeft = 275; // space for wider lane labels with gift icons
		const trackRight = W - 60; // extra margin for FINISH label
		const trackWidth = trackRight - trackLeft;

		// Draw track background
		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.beginPath();
		ctx.roundRect(
			trackLeft - 10,
			trackTop - 10,
			trackWidth + 20,
			trackHeight + 20,
			12,
		);
		ctx.fill();

		// Draw lanes
		state.lanes.forEach((lane, i) => {
			const y = trackTop + i * laneH;

			// Lane stripe (alternating)
			if (i % 2 === 0) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
				ctx.fillRect(trackLeft, y, trackWidth, laneH);
			}

			// Lane divider
			if (i > 0) {
				ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
				ctx.lineWidth = 1;
				ctx.setLineDash([8, 8]);
				ctx.beginPath();
				ctx.moveTo(trackLeft, y);
				ctx.lineTo(trackRight, y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Progress bar
			const progress = Math.min(lane.distance / config.finishLine, 1);
			const barWidth = trackWidth * progress;
			ctx.fillStyle = lane.color + "40"; // semi-transparent
			ctx.fillRect(trackLeft, y + 4, barWidth, laneH - 8);

			// Horse position
			const horseX = trackLeft + barWidth;
			const horseY = y + laneH / 2;

			// Horse circle (lane color)
			ctx.beginPath();
			ctx.arc(horseX, horseY, laneH * 0.3, 0, Math.PI * 2);
			ctx.fillStyle = lane.color;
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();

			// Country flag emoji on the horse
			const flagSize = Math.round(laneH * 0.4);
			ctx.font = `${flagSize}px serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(lane.flag, horseX, horseY);
		});

		// Finish line
		ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
		ctx.lineWidth = 3;
		ctx.setLineDash([12, 6]);
		ctx.beginPath();
		ctx.moveTo(trackRight, trackTop - 5);
		ctx.lineTo(trackRight, trackBottom + 5);
		ctx.stroke();
		ctx.setLineDash([]);

		// Finish label
		ctx.fillStyle = "#ffd700";
		ctx.font = "bold 14px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("🏁 FINISH", trackRight, trackTop - 15);
	}

	// ==========================================
	// HUD UPDATE
	// ==========================================
	function updateHUD(state) {
		// Phase text
		const phaseLabels = {
			waiting: "🏇 Waiting for gifts to start...",
			countdown: "⏳ Race starting in...",
			racing: "🏁 RACE IN PROGRESS!",
			finished: "🎉 RACE FINISHED!",
			cooldown: "⏳ Next race soon...",
		};
		phaseText.textContent = phaseLabels[state.phase] || state.phase;

		// Phase timer
		const remaining = engine.phaseRemaining();
		if (remaining !== Infinity && remaining > 0) {
			phaseTimer.textContent = Math.ceil(remaining / 1000) + "s";
		} else {
			phaseTimer.textContent = "";
		}

		// Countdown pulse animation
		if (state.phase === "countdown") {
			phaseBanner.classList.add("countdown");
		} else {
			phaseBanner.classList.remove("countdown");
		}

		// Lane labels (progress %)
		state.lanes.forEach((lane) => {
			const el = document.getElementById(`lane-label-${lane.id}`);
			if (el) {
				const pct = Math.round((lane.distance / config.finishLine) * 100);
				el.querySelector(".lane-dist").textContent = pct + "%";
			}
		});

		// Event feed
		if (state.recentEvents.length !== lastFeedCount) {
			lastFeedCount = state.recentEvents.length;
			renderFeed(state.recentEvents.slice(0, 8));
		}

		// Winner overlay
		if (state.phase === "finished" && state.winner) {
			showWinner(state.winner);
		} else {
			winnerOverlay.classList.add("hidden");
		}
	}

	function renderFeed(events) {
		eventFeedDiv.innerHTML = "";
		events.forEach((evt) => {
			const el = document.createElement("div");
			el.className = "feed-item " + evt.type;
			if (evt.type === "gift") {
				el.textContent = `${evt.giftEmoji} ${evt.nickname} → ${evt.laneFlag} (+${evt.distance})`;
			} else if (evt.type === "vote") {
				el.textContent = `💬 ${evt.nickname} → ${evt.laneFlag} (+${evt.distance})`;
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
		winnerEmoji.textContent = winner.flag;
		winnerName.textContent = winner.name + " WINS!";
		winnerName.style.color = winner.color;

		// Top 3 supporters
		const supporters = Array.from(winner.supporters.values())
			.sort((a, b) => b.totalContrib - a.totalContrib)
			.slice(0, 3);

		if (supporters.length > 0) {
			winnerSupporters.textContent =
				"Top supporters: " +
				supporters.map((s) => `${s.nickname} (${s.totalContrib})`).join(", ");
		} else {
			winnerSupporters.textContent = "";
		}
	}

	// ==========================================
	// START
	// ==========================================
	requestAnimationFrame(frame);
	console.log(
		"[HorseRacing] Game loaded, waiting for TikTokBridge connection...",
	);
})();
