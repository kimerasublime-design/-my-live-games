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
	TikTokBridge.on("gift", (data) => engine.handleGift(data));
	TikTokBridge.on("chat", (data) => engine.handleChat(data));
	TikTokBridge.on("like", (data) => engine.handleLike(data));

	// Modo demonstração: eventos fictícios locais, sem enviar nada ao TikTok.
	const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
	if (demoMode) {
		const demoBadge = document.createElement("div");
		demoBadge.textContent = "MODO DEMONSTRAÇÃO · EVENTOS SIMULADOS";
		Object.assign(demoBadge.style, {
			position: "fixed", top: "16px", right: "16px", zIndex: "1000",
			padding: "10px 14px", borderRadius: "999px",
			background: "rgba(139, 92, 246, .92)", color: "#fff",
			font: "700 12px Inter, sans-serif", letterSpacing: ".06em",
			boxShadow: "0 6px 24px rgba(139, 92, 246, .35)",
		});
		document.body.appendChild(demoBadge);

		const demoUser = { uniqueId: "kimera-demo", nickname: "Torcida Demo" };
		engine.handleChat({ user: demoUser, comment: "1" });
		let demoLane = 0;
		const demoTimer = window.setInterval(() => {
			if (engine.state.phase === "finished") return;
			const gift = config.giftTiers[0].gifts[demoLane];
			engine.handleGift({
				giftName: gift.name,
				giftId: demoLane + 1,
				giftValue: 10000,
				user: { uniqueId: `kimera-demo-${demoLane}`, nickname: `Torcida ${config.lanes[demoLane].name}` },
			});
			demoLane = (demoLane + 1) % config.lanes.length;
		}, 850);
		window.addEventListener("beforeunload", () => window.clearInterval(demoTimer), { once: true });
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
				`<span class="lane-vote">CHAT ${voteNum}</span>` +
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

			// Personagem Kimera: cavalo estilizado e exclusivo de cada pista.
			drawHorse(horseX, horseY, lane, laneH);
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
	// PERSONAGEM KIMERA — cavalo vetorial em Canvas
	// Desenhado por código para não depender de imagens externas.
	// ==========================================
	function drawHorse(x, y, lane, laneH) {
		const style = lane.horseStyle || {};
		const coat = style.coat || lane.color;
		const mane = style.mane || "#fff";
		const saddle = style.saddle || "#22D3EE";
		const marking = style.marking || "#fff";
		const scale = Math.max(0.72, Math.min(1.35, laneH / 112));

		ctx.save();
		ctx.translate(x, y);
		ctx.scale(scale, scale);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Cauda
		ctx.strokeStyle = mane;
		ctx.lineWidth = 7;
		ctx.beginPath();
		ctx.moveTo(-24, -1);
		ctx.quadraticCurveTo(-42, -17, -43, 3);
		ctx.quadraticCurveTo(-44, 13, -34, 12);
		ctx.stroke();

		// Pernas e cascos
		ctx.strokeStyle = coat;
		ctx.lineWidth = 6;
		[[-17, 11, -20, 25], [-5, 12, -7, 26], [14, 10, 17, 25], [22, 7, 27, 22]].forEach((leg) => {
			ctx.beginPath();
			ctx.moveTo(leg[0], leg[1]);
			ctx.lineTo(leg[2], leg[3]);
			ctx.stroke();
			ctx.fillStyle = "#252033";
			ctx.fillRect(leg[2] - 3, leg[3] - 1, 7, 4);
		});

		// Corpo
		ctx.fillStyle = coat;
		ctx.beginPath();
		ctx.ellipse(-2, 1, 27, 15, -0.04, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,.55)";
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// Pescoço, cabeça e orelhas
		ctx.beginPath();
		ctx.moveTo(12, -7);
		ctx.quadraticCurveTo(19, -19, 23, -27);
		ctx.lineTo(34, -24);
		ctx.quadraticCurveTo(37, -17, 31, -12);
		ctx.lineTo(20, 2);
		ctx.closePath();
		ctx.fillStyle = coat;
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(33, -25, 12, 8, -0.2, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(27, -31);
		ctx.lineTo(25, -42);
		ctx.lineTo(34, -33);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(36, -31);
		ctx.lineTo(43, -39);
		ctx.lineTo(42, -27);
		ctx.fill();

		// Crinas com silhuetas diferentes para cada competidor
		ctx.fillStyle = mane;
		ctx.beginPath();
		if (style.maneType === "flowing") {
			ctx.moveTo(18, -29);
			ctx.quadraticCurveTo(4, -37, 9, -47);
			ctx.quadraticCurveTo(19, -40, 22, -48);
			ctx.quadraticCurveTo(30, -39, 33, -33);
		} else if (style.maneType === "flame") {
			ctx.moveTo(18, -29);
			ctx.lineTo(11, -44);
			ctx.lineTo(23, -38);
			ctx.lineTo(27, -49);
			ctx.lineTo(34, -33);
		} else if (style.maneType === "sleek") {
			ctx.moveTo(18, -29);
			ctx.quadraticCurveTo(20, -43, 38, -39);
			ctx.quadraticCurveTo(34, -32, 33, -30);
		} else {
			ctx.moveTo(17, -29);
			ctx.lineTo(13, -44);
			ctx.lineTo(24, -38);
			ctx.lineTo(28, -48);
			ctx.lineTo(34, -32);
		}
		ctx.closePath();
		ctx.fill();

		// Sela, marca facial e detalhes
		ctx.fillStyle = saddle;
		ctx.beginPath();
		ctx.ellipse(-4, -5, 13, 8, -0.12, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = marking;
		ctx.beginPath();
		ctx.moveTo(32, -31);
		ctx.lineTo(35, -25);
		ctx.lineTo(32, -17);
		ctx.lineTo(29, -25);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = "#171323";
		ctx.beginPath();
		ctx.arc(38, -27, 1.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "rgba(255,255,255,.8)";
		ctx.beginPath();
		ctx.ellipse(42, -22, 4, 2.5, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	// ==========================================
	// HUD UPDATE
	// ==========================================
	function updateHUD(state) {
		// Phase text
		const phaseLabels = {
			waiting: "🏇 Aguardando a primeira participação...",
			countdown: "⏳ A corrida começa em...",
			racing: "🏁 CORRIDA EM ANDAMENTO!",
			finished: "🎉 CORRIDA FINALIZADA!",
			cooldown: "⏳ Próxima corrida em instantes...",
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
		winnerName.textContent = winner.name + " VENCEU!";
		winnerName.style.color = winner.color;

		// Top 3 supporters
		const supporters = Array.from(winner.supporters.values())
			.sort((a, b) => b.totalContrib - a.totalContrib)
			.slice(0, 3);

		if (supporters.length > 0) {
			winnerSupporters.textContent =
				"Destaques da torcida: " +
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
		"[Kimera Live Games] Corrida carregada; aguardando conexão com TikTokBridge.",
	);
})();
