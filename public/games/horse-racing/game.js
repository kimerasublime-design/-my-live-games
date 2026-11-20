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

	function frame(timestamp = 0) {
		const state = engine.tick();
		drawTrack(state, timestamp);
		updateHUD(state);
		requestAnimationFrame(frame);
	}

	// ==========================================
	// CANVAS DRAWING
	// ==========================================
	function drawTrack(state, timestamp = 0) {
		const W = canvas.width;
		const H = canvas.height;
		const laneCount = state.lanes.length;
		const top = H * 0.20;
		const bottom = H * 0.91;
		const laneH = (bottom - top) / laneCount;
		const scroll = timestamp * (state.phase === "racing" ? 0.075 : 0.018);

		ctx.clearRect(0, 0, W, H);

		// Céu e luz ambiente
		const sky = ctx.createLinearGradient(0, 0, 0, H * 0.34);
		sky.addColorStop(0, "#55a6e6");
		sky.addColorStop(1, "#c2e5f8");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H * 0.34);

		// Árvores e linha do horizonte
		for (let i = 0; i < 34; i++) {
			const x = ((i * 83 - scroll * 0.22) % (W + 100) + W + 100) % (W + 100) - 40;
			const y = H * 0.205 + Math.sin(i * 7.3) * 7;
			ctx.fillStyle = i % 3 === 0 ? "#476e43" : "#628d50";
			ctx.beginPath();
			ctx.arc(x, y, 13 + (i % 4) * 3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#6c934d";
		ctx.fillRect(0, H * 0.22, W, H * 0.09);

		// Arquibancada estilizada no fundo
		ctx.fillStyle = "#68747a";
		ctx.fillRect(0, H * 0.145, W * 0.43, H * 0.065);
		ctx.fillStyle = "#38454d";
		ctx.beginPath();
		ctx.moveTo(0, H * 0.145);
		ctx.lineTo(W * 0.45, H * 0.145);
		ctx.lineTo(W * 0.39, H * 0.125);
		ctx.lineTo(0, H * 0.125);
		ctx.closePath();
		ctx.fill();
		for (let i = 0; i < 11; i++) {
			ctx.fillStyle = i % 2 ? "#a94e55" : "#d0a4a0";
			ctx.fillRect(i * W * 0.038, H * 0.16, W * 0.032, H * 0.028);
		}

		// Gramado interno e cercas paralelas
		ctx.fillStyle = "#78a653";
		ctx.fillRect(0, H * 0.255, W, H * 0.105);
		ctx.fillStyle = "#dce6df";
		[0.285, 0.315, 0.35].forEach((p) => {
			ctx.fillRect(0, H * p, W, Math.max(2, H * 0.003));
		});
		for (let x = -((scroll * 0.55) % 52); x < W; x += 52) {
			ctx.fillStyle = "#e8eee9";
			ctx.fillRect(x, H * 0.275, 3, H * 0.09);
		}

		// Pista de areia com textura e perspectiva
		const dirt = ctx.createLinearGradient(0, H * 0.36, 0, H);
		dirt.addColorStop(0, "#b78a62");
		dirt.addColorStop(0.48, "#9b704d");
		dirt.addColorStop(1, "#795337");
		ctx.fillStyle = dirt;
		ctx.fillRect(0, H * 0.36, W, H * 0.64);
		for (let i = 0; i < 190; i++) {
			const x = (i * 47 + (scroll * (0.35 + (i % 4) * 0.1))) % W;
			const y = H * 0.37 + ((i * 97) % Math.max(1, Math.floor(H * 0.62)));
			ctx.fillStyle = i % 2 ? "rgba(65,39,22,.10)" : "rgba(238,199,151,.12)";
			ctx.beginPath();
			ctx.ellipse(x, y, 1 + (i % 3), 1 + (i % 2), 0, 0, Math.PI * 2);
			ctx.fill();
		}

		// Linhas de largada/raias, deslocando-se para reforçar velocidade
		for (let i = 0; i < laneCount; i++) {
			const y = top + i * laneH + laneH * 0.82;
			ctx.fillStyle = "rgba(255,255,255,.72)";
			const dash = Math.max(18, W * 0.075);
			for (let x = -((scroll * 1.5) % (dash * 2)); x < W; x += dash * 2) {
				ctx.fillRect(x, y, dash, Math.max(3, H * 0.004));
			}
			ctx.fillStyle = "rgba(255,255,255,.82)";
			ctx.font = "900 " + Math.max(18, Math.min(34, laneH * 0.42)) + "px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(String(i + 1), W * 0.13, y - H * 0.012);
		}

		// Cavalos: cada pista mantém sua identidade, progresso e eventos do motor
		state.lanes.forEach((lane, i) => {
			const y = top + i * laneH + laneH * 0.48;
			const progress = Math.max(0, Math.min(lane.distance / config.finishLine, 1));
			const startX = W * 0.19;
			const finishX = W * 0.91;
			const horseX = startX + (finishX - startX) * progress;
			drawHorse(horseX, y, lane, laneH, timestamp, state.phase);
		});

		// Linha de chegada
		const finishX = W * 0.94;
		ctx.save();
		ctx.strokeStyle = "#fff4cf";
		ctx.lineWidth = Math.max(3, W * 0.008);
		ctx.setLineDash([10, 7]);
		ctx.beginPath();
		ctx.moveTo(finishX, H * 0.37);
		ctx.lineTo(finishX, H * 0.96);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = "#fff";
		ctx.font = "bold 12px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("CHEGADA", finishX - 2, H * 0.375);
		ctx.restore();
	}

	// ==========================================
	// PERSONAGEM KIMERA — cavalo vetorial em Canvas
	// Desenhado por código para não depender de imagens externas.
	// ==========================================
	function drawHorse(x, y, lane, laneH, timestamp, phase) {
		const style = lane.horseStyle || {};
		const coat = style.coat || lane.color || "#9b623e";
		const mane = style.mane || "#2b1b16";
		const silk = ["#167b59", "#c83232", "#263f9c", "#7b35b5", "#d66b28"][lane.id % 5];
		const helmet = ["#f2eee2", "#f2a52b", "#5d50bf", "#b35acb", "#284d79"][lane.id % 5];
		const scale = Math.max(0.56, Math.min(1.12, laneH / 92));
		const racing = phase === "racing";
		const speed = racing ? 1 : phase === "countdown" ? 0.48 : 0.2;
		const gait = timestamp * (racing ? 0.014 : 0.006) + lane.id * 1.17;
		const bob = Math.sin(gait * 2) * (racing ? 3.2 : 1.1);
		const tail = Math.sin(gait * 1.3) * (racing ? 0.22 : 0.07);
		const legSwing = Math.sin(gait) * speed;

		ctx.save();
		ctx.translate(x, y + bob);
		ctx.scale(scale, scale);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Sombra de contato
		ctx.fillStyle = "rgba(42,27,17,.25)";
		ctx.beginPath();
		ctx.ellipse(-2, 36, 51, 7, 0, 0, Math.PI * 2);
		ctx.fill();

		// Cauda em mechas
		ctx.save();
		ctx.translate(-39, -5);
		ctx.rotate(tail);
		ctx.strokeStyle = mane;
		ctx.lineWidth = 7;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.quadraticCurveTo(-20, 4, -37, 18);
		ctx.quadraticCurveTo(-22, 19, -5, 9);
		ctx.stroke();
		ctx.lineWidth = 2;
		ctx.strokeStyle = "rgba(255,255,255,.18)";
		ctx.beginPath();
		ctx.moveTo(-3, 4);
		ctx.quadraticCurveTo(-20, 9, -32, 16);
		ctx.stroke();
		ctx.restore();

		// Pernas traseiras e dianteiras com articulação em dois segmentos
		const legSpecs = [
			{ x: -29, phase: 0.0, rear: true },
			{ x: -15, phase: Math.PI, rear: true },
			{ x: 19, phase: Math.PI, rear: false },
			{ x: 31, phase: 0.0, rear: false },
		];
		legSpecs.forEach((leg, index) => {
			const a = Math.sin(gait + leg.phase) * (racing ? 0.72 : 0.16);
			const lift = Math.max(0, Math.cos(gait + leg.phase)) * (racing ? 8 : 1.5);
			ctx.save();
			ctx.translate(leg.x, 12);
			ctx.rotate(a);
			ctx.strokeStyle = leg.rear && lane.id === 2 ? "#202126" : coat;
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(leg.rear ? -4 : 3, 13 - lift * 0.35);
			ctx.lineTo(leg.rear ? -7 : 6, 28 - lift);
			ctx.stroke();
			ctx.strokeStyle = "rgba(30,22,18,.28)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(leg.rear ? -4 : 3, 13 - lift * 0.35);
			ctx.lineTo(leg.rear ? -7 : 6, 27 - lift);
			ctx.stroke();
			ctx.fillStyle = "#211b18";
			ctx.beginPath();
			ctx.roundRect(leg.rear ? -11 : 1, 25 - lift, 12, 5, 2);
			ctx.fill();
			ctx.restore();
		});

		// Tronco com volume e brilho de pelagem
		ctx.fillStyle = coat;
		ctx.beginPath();
		ctx.ellipse(-1, 0, 43, 21, -0.04, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,224,184,.36)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.ellipse(-4, -5, 31, 11, -0.08, Math.PI * 1.08, Math.PI * 1.86);
		ctx.stroke();

		// Padrões distintos: malhado no terceiro e tordilho no quinto
		if (lane.id === 2) {
			ctx.fillStyle = "#202126";
			[[-22,-5,12,9],[8,4,15,10],[25,-7,7,6]].forEach(([sx,sy,rx,ry]) => {
				ctx.beginPath(); ctx.ellipse(sx,sy,rx,ry,-.2,0,Math.PI*2); ctx.fill();
			});
		} else if (lane.id === 4) {
			ctx.fillStyle = "rgba(255,255,255,.55)";
			for (let sx=-27; sx<=25; sx+=10) for (let sy=-10; sy<=10; sy+=9) {
				ctx.beginPath(); ctx.arc(sx,sy,2.1,0,Math.PI*2); ctx.fill();
			}
		}

		// Pescoço, crina e cabeça com oscilação
		ctx.save();
		ctx.translate(27, -7 + Math.sin(gait * 2) * (racing ? 2 : .5));
		ctx.rotate(Math.sin(gait * 1.7) * (racing ? .055 : .018));
		ctx.fillStyle = coat;
		ctx.beginPath();
		ctx.moveTo(-8, 12); ctx.quadraticCurveTo(4,-8,15,-29);
		ctx.quadraticCurveTo(27,-34,32,-23); ctx.lineTo(17,12); ctx.closePath();
		ctx.fill();
		ctx.fillStyle = mane;
		ctx.beginPath();
		if (style.maneType === "flowing") {
			ctx.moveTo(8,-22); ctx.quadraticCurveTo(-3,-39,9,-49);
			ctx.quadraticCurveTo(18,-39,23,-48); ctx.quadraticCurveTo(29,-35,25,-25);
		} else if (style.maneType === "flame") {
			ctx.moveTo(8,-23); ctx.lineTo(3,-43); ctx.lineTo(17,-34);
			ctx.lineTo(23,-50); ctx.lineTo(29,-27);
		} else {
			ctx.moveTo(8,-24); ctx.quadraticCurveTo(12,-43,31,-40);
			ctx.quadraticCurveTo(28,-31,25,-25);
		}
		ctx.closePath(); ctx.fill();
		ctx.fillStyle = coat;
		ctx.beginPath();
		ctx.ellipse(34,-25,16,9,-.2,0,Math.PI*2);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(25,-31); ctx.lineTo(23,-43); ctx.lineTo(32,-34);
		ctx.moveTo(37,-32); ctx.lineTo(45,-41); ctx.lineTo(43,-28);
		ctx.fill();
		ctx.fillStyle = "#181411";
		ctx.beginPath(); ctx.arc(39,-27,1.8,0,Math.PI*2); ctx.fill();
		ctx.fillStyle = "rgba(255,235,215,.8)";
		ctx.beginPath(); ctx.ellipse(48,-21,4,2,0,0,Math.PI*2); ctx.fill();
		ctx.restore();

		// Manta numerada
		ctx.fillStyle = "#f7f4ec";
		ctx.strokeStyle = "#29231f";
		ctx.lineWidth = 1.4;
		ctx.fillRect(-13,-17,24,17);
		ctx.strokeRect(-13,-17,24,17);
		ctx.fillStyle = "#181818";
		ctx.font = "bold 13px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText(String(lane.id + 1), -1, -5);

		// Jóquei em posição de corrida, uniforme e capacete próprios
		ctx.save();
		ctx.translate(0,-24 - Math.sin(gait * 2) * (racing ? 2 : .5));
		ctx.rotate(.42);
		ctx.fillStyle = "#f3eee5";
		ctx.beginPath(); ctx.roundRect(-7,3,13,8,3); ctx.fill();
		ctx.fillStyle = "#202027";
		ctx.fillRect(-3,9,6,11);
		ctx.fillStyle = silk;
		ctx.beginPath(); ctx.roundRect(-6,-17,15,22,4); ctx.fill();
		ctx.strokeStyle = silk;
		ctx.lineWidth = 4;
		ctx.beginPath(); ctx.moveTo(4,-12); ctx.lineTo(17,-3); ctx.stroke();
		ctx.fillStyle = helmet;
		ctx.beginPath(); ctx.arc(2,-22,7,0,Math.PI*2); ctx.fill();
		ctx.fillRect(3,-23,9,2.5);
		ctx.restore();

		// Poeira levantada pelos cascos
		if (racing && Math.sin(gait + lane.id) > .55) {
			ctx.fillStyle = "rgba(224,190,153,.32)";
			ctx.beginPath();
			ctx.arc(-32 + Math.sin(gait)*5, 31, 5 + Math.abs(Math.sin(gait))*4, 0, Math.PI*2);
			ctx.fill();
		}
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
