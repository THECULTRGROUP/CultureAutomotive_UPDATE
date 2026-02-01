// Filename: public/wheel.js
// @ts-nocheck
window.addEventListener('DOMContentLoaded', () => {
  console.log("✅ wheel.js loaded");

  const spinBtn = document.getElementById("spinBtn");
  const emailInput = document.getElementById("emailInput");
  const result = document.getElementById("result");
  const wheelCanvas = document.getElementById("wheelCanvas");
  const ctx = wheelCanvas.getContext("2d");
  const confettiCanvas = document.getElementById("confetti");
  const confettiCtx = confettiCanvas.getContext("2d");
  let spinning = false;

  const slices = [
    { label: "5% OFF", code: "LUCKY5" },
    { label: "10% OFF", code: "GOLD10" },
    { label: "15% OFF", code: "JACKPOT15" },
    { label: "Free Shipping", code: "FREESHIP" },
    { label: "Not this time", code: null },
    { label: "20% OFF", code: "BIGWIN20" }
  ];

  const sliceCount = slices.length;
  const sliceAngle = 2 * Math.PI / sliceCount;

  function createGradient(ctx, x, y, r, colors) {
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    colors.forEach((stop) => grad.addColorStop(stop[0], stop[1]));
    return grad;
  }

  function drawWheel(rotation = 0) {
    const canvasSize = wheelCanvas.width; // For example, 260
    const center = canvasSize / 2;
    const radius = canvasSize / 2;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    for (let i = 0; i < sliceCount; i++) {
      const start = i * sliceAngle + rotation;
      const end = (i + 1) * sliceAngle + rotation;
      const grad = createGradient(
        ctx,
        center,
        center,
        radius,
        (i % 2 === 0)
          ? [[0, '#ff3c3c'], [1, '#800000']]
          : [[0, '#555'], [1, '#222']]
      );

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + sliceAngle / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slices[i].label, radius * 0.6, 0);
      ctx.restore();
    }

    const cGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.25);
    cGrad.addColorStop(0, '#ff3c3c');
    cGrad.addColorStop(1, '#800000');

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.25, 0, 2 * Math.PI);
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = '#500000';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawWheel();

  spinBtn.addEventListener("click", () => {
    if (spinning) return;
    const email = emailInput.value.trim();
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email.");
      return;
    }
    window.parent.postMessage({ type: "checkEmail", email }, "*");
  });

  window.addEventListener("message", (event) => {
    if (event.data.type === "checkEmailResult") {
      if (event.data.success) {
        startSpin();
      } else {
        alert(event.data.message);
      }
    }
  });

  function startSpin() {
    spinning = true;
    confettiCanvas.width = wheelCanvas.width;
    confettiCanvas.height = wheelCanvas.height;
    const spinTime = 5000;
    const spins = Math.random() * 7 + 10;
    const finalSlice = Math.floor(Math.random() * sliceCount);
    const finalRotation = (sliceCount - finalSlice) * sliceAngle;
    const start = performance.now();

    function animate(now) {
      const t = Math.min((now - start) / spinTime, 1);
      const easeOut = 1 - Math.pow(1 - t, 4);
      const rotation = spins * 2 * Math.PI * easeOut + finalRotation;
      drawWheel(rotation);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        spinning = false;
        const prize = slices[finalSlice];
        result.innerHTML = prize.code
          ? `🎉 You won: <strong>${prize.label}</strong><br>Use code: <strong>${prize.code}</strong>`
          : `😔 ${prize.label}`;
        if (prize.code) launchConfetti();
      }
    }

    requestAnimationFrame(animate);
  }

  function launchConfetti() {
    const confettiParticles = [];
    for (let i = 0; i < 80; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height,
        r: Math.random() * 5 + 3,
        d: Math.random() * 40,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        tilt: Math.random() * 10 - 10
      });
    }

    function draw() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles.forEach(p => {
        confettiCtx.beginPath();
        confettiCtx.lineWidth = p.r / 2;
        confettiCtx.strokeStyle = p.color;
        confettiCtx.moveTo(p.x + p.tilt + 5, p.y);
        confettiCtx.lineTo(p.x + p.tilt, p.y + p.r);
        confettiCtx.stroke();
      });
      update();
    }

    function update() {
      confettiParticles.forEach(p => {
        p.y += Math.cos(p.d) + 1;
        p.x += Math.sin(p.d);
        p.tilt = Math.sin(p.y / 10) * 10;
        if (p.y > confettiCanvas.height) {
          p.y = -10;
          p.x = Math.random() * confettiCanvas.width;
        }
      });
    }

    (function animate() {
      draw();
      requestAnimationFrame(animate);
    })();
  }
});
