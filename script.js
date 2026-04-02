const { Engine, Render, Runner, Bodies, Composite, Constraint, Mouse, MouseConstraint, Vector, Events, Body, Vertices } = Matter;

// --- CONFIGURATION ---
const engine = Engine.create();
const world = engine.world;
const width = window.innerWidth;
const height = window.innerHeight;

const matterCanvas = document.getElementById('matter-canvas');
const uiCanvas = document.getElementById('ui-canvas');
const uiCtx = uiCanvas.getContext('2d');

matterCanvas.width = uiCanvas.width = width;
matterCanvas.height = uiCanvas.height = height;

const render = Render.create({
    canvas: matterCanvas,
    engine: engine,
    options: {
        width,
        height,
        wireframes: false,
        background: 'transparent'
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);

// --- ÉTAT DU JEU ---
let score = 0;
let lancers = 0;
let fautes = 0;
const MAX_SCORE = 50;

// --- SOL PHYSIQUE ---
const groundHeight = 60;
const groundY = height - (groundHeight / 2);
const groundTop = height - groundHeight;
const ground = Bodies.rectangle(width / 2, groundY, width * 3, groundHeight, {
    isStatic: true,
    label: 'ground',
    render: { visible: false },
    friction: 0.8
});
Composite.add(world, ground);

// --- QUILLES ---
let pins = [];
const initMolkky = () => {
    if (pins.length > 0) Composite.remove(world, pins);
    pins = [];

    // --- RÉGLAGES POSITION MILIEU ET RESSERREMENT ---
    const spacing = 32;
    const totalWidth = 12 * spacing;
    // STARTX modifié pour centrer les quilles au milieu (0.5) de l'écran
    const startX = (width * 0.5) - (totalWidth / 2);

    const ordreQuilles = [1, 2, 3, 4, 10, 11, 12, 5, 6, 7, 8, 9];

    const biseauPath = [
        { x: -11, y: 22 },
        { x: 11, y: 22 },
        { x: 11, y: -5 },
        { x: -11, y: -22 }
    ];

    ordreQuilles.forEach((valeur, index) => {
        const x = startX + (index * spacing);
        const y = groundTop - 23;

        const pin = Bodies.fromVertices(x, y, [biseauPath], {
            restitution: 0.3,
            friction: 0.4,
            density: 0.001,
            label: 'pin',
            render: {
                fillStyle: `hsl(${valeur * 30}, 65%, 60%)`,
                strokeStyle: '#000000',
                lineWidth: 3
            }
        });
        pin.value = valeur;
        pin.homePosition = { x, y };
        pins.push(pin);
    });
    Composite.add(world, pins);
};

// --- LANCEUR ---
let baton, sling;
// L'ancre reste à gauche pour garder la distance de tir vers le milieu
const anchor = { x: 100, y: height - 200 };
const STIFFNESS = 0.04;
const BATON_HEIGHT = 18;

const createBaton = () => {
    baton = Bodies.rectangle(anchor.x, anchor.y, 55, BATON_HEIGHT, {
        density: 0.02,
        frictionAir: 0.005,
        label: 'baton',
        render: {
            fillStyle: '#ff4b2b',
            strokeStyle: '#000000',
            lineWidth: 3
        }
    });

    sling = Constraint.create({
        pointA: anchor,
        bodyB: baton,
        stiffness: STIFFNESS,
        length: 2,
        render: { visible: false }
    });

    Composite.add(world, [baton, sling]);
};

// --- SOURIS ---
const mouse = Mouse.create(matterCanvas);
const mc = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.1, render: { visible: false } }
});
Composite.add(world, mc);

// === RENDU : SOL VISUEL + VISÉUR + NUMÉROS ===
Events.on(render, 'afterRender', () => {
    uiCtx.clearRect(0, 0, width, height);

    // --- DESSIN DU SOL ---
    uiCtx.save();
    const grad = uiCtx.createLinearGradient(0, groundTop, 0, height);
    grad.addColorStop(0, '#2e7d32');
    grad.addColorStop(1, '#1b5e20');

    uiCtx.fillStyle = grad;
    uiCtx.fillRect(0, groundTop, width, groundHeight);

    uiCtx.strokeStyle = '#000';
    uiCtx.lineWidth = 2;
    uiCtx.beginPath();
    uiCtx.moveTo(0, groundTop);
    uiCtx.lineTo(width, groundTop);
    uiCtx.stroke();
    uiCtx.restore();

    // --- VISÉUR ---
    const isDragging = (mc.body === baton) || (sling && sling.bodyB === baton);
    if (isDragging && baton) {
        const diff = Vector.sub(anchor, baton.position);
        let vx = diff.x * STIFFNESS;
        let vy = diff.y * STIFFNESS;
        let px = baton.position.x;
        let py = baton.position.y;
        const gravity = engine.gravity.y * engine.gravity.scale;
        const airFriction = 1 - baton.frictionAir;
        const limitY = groundTop - (BATON_HEIGHT / 2);

        uiCtx.save();
        uiCtx.beginPath();
        uiCtx.setLineDash([5, 8]);
        uiCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        uiCtx.lineWidth = 2;
        uiCtx.moveTo(px, py);

        for (let i = 0; i < 500; i++) {
            vx *= airFriction; vy *= airFriction;
            vy += gravity; px += vx; py += vy;
            uiCtx.lineTo(px, py);
            if (py >= limitY) break;
        }
        uiCtx.stroke();
        uiCtx.restore();
    }

    // --- NUMÉROS ---
    uiCtx.fillStyle = "#fff";
    uiCtx.font = "bold 14px Arial";
    uiCtx.textAlign = "center";
    uiCtx.shadowBlur = 4;
    uiCtx.shadowColor = "black";
    pins.forEach(p => {
        if (Math.abs(p.angle) < 0.2) uiCtx.fillText(p.value, p.position.x, p.position.y + 5);
    });
});

// --- LOGIQUE DE JEU ---
let isFired = false;
Events.on(mc, 'enddrag', (e) => { if (e.body === baton) isFired = true; });

Events.on(engine, 'afterUpdate', () => {
    if (isFired && baton) {
        if (Vector.magnitude(Vector.sub(baton.position, anchor)) > 30) {
            if (sling) { Composite.remove(world, sling); sling = null; }
            Body.setAngularVelocity(baton, 0.2);
            isFired = false;
            setTimeout(resolveTurn, 3500);
        }
    }
});

function resolveTurn() {
    const outOfBoundsPins = pins.filter(p => p.position.x < 0 || p.position.x > width || p.position.y > height);
    const fallenInField = pins.filter(p => !outOfBoundsPins.includes(p) && Math.abs(p.angle) > 1.4);

    let turnPoints = 0;
    if (fallenInField.length === 1) {
        turnPoints = fallenInField[0].value;
    } else if (fallenInField.length > 1) {
        turnPoints = fallenInField.length;
    }

    if (turnPoints === 0) {
        fautes++;
        showMsg(`Manqué ! Faute ${fautes}/3`, "#ff4b2b");
    } else {
        fautes = 0;
        score += turnPoints;
        showMsg(`+ ${turnPoints} Points`, "#00f2fe");
    }

    if (score > MAX_SCORE) { score = 25; showMsg("Dépassement ! Retour à 25", "#ffeb3b"); }
    if (fautes >= 3) { alert("3 fautes ! Fin de partie."); score = 0; fautes = 0; resetGame(); return; }

    outOfBoundsPins.forEach(p => {
        Body.setAngle(p, 0);
        Body.setVelocity(p, { x: 0, y: 0 });
        Body.setAngularVelocity(p, 0);
        Body.setPosition(p, p.homePosition);
    });

    fallenInField.forEach(p => {
        let safeX = Math.max(40, Math.min(width - 40, p.position.x));
        Body.setAngle(p, 0);
        Body.setVelocity(p, { x: 0, y: 0 });
        Body.setAngularVelocity(p, 0);
        Body.setPosition(p, { x: safeX, y: groundTop - 25 });
    });

    if (score === MAX_SCORE) {
        showMsg("VICTOIRE !", "#4caf50");
        setTimeout(resetGame, 4000);
        return;
    }

    lancers++;
    updateHUD();
    resetBaton();
}

function updateHUD() {
    const scoreEl = document.getElementById('val-score');
    const lancersEl = document.getElementById('val-lancers');
    const fautesEl = document.getElementById('val-fautes');

    if (scoreEl) scoreEl.innerText = score;
    if (lancersEl) lancersEl.innerText = lancers;
    if (fautesEl) fautesEl.innerText = fautes;
}

function showMsg(txt, color) {
    const msgEl = document.getElementById('msg-points');
    if (msgEl) {
        msgEl.innerText = txt;
        msgEl.style.color = color;
    }
}

function resetBaton() {
    if (baton) Composite.remove(world, baton);
    createBaton();
}

function resetGame() {
    score = 0; lancers = 0; fautes = 0;
    updateHUD();
    showMsg("Nouveau jeu", "#fff");
    initMolkky();
    resetBaton();
}

// Lancement initial
initMolkky();
createBaton();

window.addEventListener('resize', () => {
    location.reload();
});