var canvas = document.getElementById("tela");
var ctx = canvas.getContext("2d");
var textoStatus = document.getElementById("status");
var textoPapel = document.getElementById("papel");

var socket = io();

var meuPapel = null;
var fase = "espera"; // espera, jogando, fim
var tempo = 60;
var paralisada = false;
var posicoes = {};
var mensagemFim = "";

var largura = 30;
var altura = 40;

var eu = { x: 0, y: 0, vx: 0, vy: 0, pulos: 0 };
var teclas = {};

var plataformas = [
    { x: 0, y: 480, w: 900 },
    { x: 100, y: 410, w: 120 },
    { x: 300, y: 360, w: 120 },
    { x: 520, y: 410, w: 120 },
    { x: 700, y: 340, w: 130 },
    { x: 450, y: 280, w: 120 },
    { x: 200, y: 260, w: 120 },
    { x: 20, y: 180, w: 120 },
    { x: 350, y: 170, w: 100 },
    { x: 650, y: 210, w: 120 },
    { x: 780, y: 120, w: 100 }
];

var cores = {
    barbie: "#ff4fa3",
    ken: "#3a8dde",
    raquel: "#8e44ad"
};

var emojis = {
    barbie: "👱‍♀️",
    ken: "🧑",
    raquel: "👩‍🦰"
};

var nomes = {
    barbie: "Barbie",
    ken: "Ken",
    raquel: "Raquel"
};

// ---------- eventos do servidor ----------

socket.on("papel", function (papel) {
    meuPapel = papel;
    textoPapel.innerText = "Você é: " + nomes[papel] + " " + emojis[papel];
    if (papel == "raquel") {
        textoStatus.innerText = "Esperando os outros jogadores... Seu objetivo: pegar o Ken!";
    } else if (papel == "ken") {
        textoStatus.innerText = "Esperando os outros jogadores... Seu objetivo: fugir da Raquel!";
    } else {
        textoStatus.innerText = "Esperando os outros jogadores... Seu objetivo: proteger o Ken! (encoste na Raquel para paralisar ela)";
    }
});

socket.on("lobby", function (quantidade) {
    if (fase != "jogando") {
        textoStatus.innerText = "Jogadores conectados: " + quantidade + "/3";
    }
});

socket.on("cheio", function () {
    textoStatus.innerText = "Sala cheia! Já tem 3 jogadores.";
});

socket.on("comecou", function (posicoesIniciais) {
    fase = "jogando";
    posicoes = posicoesIniciais;
    eu.x = posicoes[meuPapel].x;
    eu.y = posicoes[meuPapel].y;
    eu.vx = 0;
    eu.vy = 0;
    eu.pulos = 0;
    paralisada = false;
    mensagemFim = "";
});

socket.on("tempo", function (t) {
    tempo = t;
});

socket.on("estado", function (dados) {
    posicoes = dados.posicoes;
    paralisada = dados.paralisada;
});

socket.on("fim", function (vencedor) {
    fase = "fim";
    if (vencedor == "raquel") {
        mensagemFim = "A Raquel pegou o Ken! 💔";
    } else {
        mensagemFim = "A Barbie ficou com o Ken! 💖";
    }
    textoStatus.innerText = mensagemFim + " (nova partida já já...)";
});

socket.on("saiu", function () {
    fase = "espera";
    textoStatus.innerText = "Alguém saiu da partida. Esperando 3 jogadores...";
});

// ---------- teclado ----------

document.addEventListener("keydown", function (e) {
    var tecla = e.key.toLowerCase();
    teclas[tecla] = true;

    if (tecla == " " || tecla == "arrowup" || tecla == "w") {
        e.preventDefault();
        pular();
    }
    if (tecla == "arrowleft" || tecla == "arrowright") {
        e.preventDefault();
    }
});

document.addEventListener("keyup", function (e) {
    teclas[e.key.toLowerCase()] = false;
});

function pular() {
    if (fase != "jogando") {
        return;
    }
    if (meuPapel == "raquel" && paralisada) {
        return;
    }
    if (eu.pulos < 2) {
        eu.vy = -12;
        eu.pulos = eu.pulos + 1;
    }
}

// ---------- movimento ----------

function mover() {
    if (fase != "jogando" || meuPapel == null) {
        return;
    }

    var velocidade = 4.5;
    if (meuPapel == "raquel") {
        velocidade = 4.8;
        if (paralisada) {
            velocidade = 0;
        }
    }

    eu.vx = 0;
    if (teclas["a"] || teclas["arrowleft"]) {
        eu.vx = -velocidade;
    }
    if (teclas["d"] || teclas["arrowright"]) {
        eu.vx = velocidade;
    }

    var yAntes = eu.y;

    eu.vy = eu.vy + 0.6; // gravidade
    eu.x = eu.x + eu.vx;
    eu.y = eu.y + eu.vy;

    // sai pela direita e aparece na esquerda (e vice-versa)
    if (eu.x > canvas.width) {
        eu.x = -largura;
    }
    if (eu.x < -largura) {
        eu.x = canvas.width;
    }

    // colisão com as plataformas (só pousa por cima)
    for (var i = 0; i < plataformas.length; i++) {
        var p = plataformas[i];
        var pesAntes = yAntes + altura;
        var pesAgora = eu.y + altura;
        var dentroX = eu.x + largura > p.x && eu.x < p.x + p.w;

        if (eu.vy >= 0 && dentroX && pesAntes <= p.y && pesAgora >= p.y) {
            eu.y = p.y - altura;
            eu.vy = 0;
            eu.pulos = 0;
        }
    }

    socket.emit("mover", { x: eu.x, y: eu.y });
}

// ---------- desenho ----------

function desenharPersonagem(papel, x, y) {
    ctx.fillStyle = cores[papel];
    ctx.fillRect(x, y, largura, altura);

    ctx.font = "26px Arial";
    ctx.textAlign = "center";
    ctx.fillText(emojis[papel], x + largura / 2, y + 28);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#333";
    ctx.fillText(nomes[papel], x + largura / 2, y - 6);
}

function desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // plataformas
    for (var i = 0; i < plataformas.length; i++) {
        var p = plataformas[i];
        ctx.fillStyle = "#f78fc3";
        ctx.fillRect(p.x, p.y, p.w, 12);
    }

    if (fase == "jogando" || fase == "fim") {
        var papeisLista = ["barbie", "ken", "raquel"];
        for (var j = 0; j < papeisLista.length; j++) {
            var papel = papeisLista[j];
            if (posicoes[papel]) {
                if (papel == meuPapel) {
                    desenharPersonagem(papel, eu.x, eu.y);
                } else {
                    desenharPersonagem(papel, posicoes[papel].x, posicoes[papel].y);
                }
            }
        }

        // tempo
        ctx.fillStyle = "#8a1c5c";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "left";
        ctx.fillText("⏱ " + tempo + "s", 15, 30);

        if (paralisada) {
            ctx.fillStyle = "#8e44ad";
            ctx.textAlign = "center";
            ctx.fillText("Raquel paralisada! 😵", canvas.width / 2, 30);
        }
    }

    if (fase == "fim") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 180, canvas.width, 120);
        ctx.fillStyle = "white";
        ctx.font = "bold 40px Arial";
        ctx.textAlign = "center";
        ctx.fillText(mensagemFim, canvas.width / 2, 253);
    }
}

function loop() {
    mover();
    desenhar();
    requestAnimationFrame(loop);
}

loop();

// atualiza o texto do status durante o jogo
setInterval(function () {
    if (fase == "jogando") {
        if (meuPapel == "raquel") {
            textoStatus.innerText = "Pegue o Ken antes que o tempo acabe!";
        } else if (meuPapel == "ken") {
            textoStatus.innerText = "Fuja da Raquel! Aguente até o tempo acabar!";
        } else {
            textoStatus.innerText = "Proteja o Ken! Encoste na Raquel para paralisar ela.";
        }
    }
}, 500);
