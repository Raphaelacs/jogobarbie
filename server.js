var express = require("express");
var http = require("http");
var socketio = require("socket.io");

var app = express();
var servidor = http.createServer(app);
var io = new socketio.Server(servidor);

app.use(express.static("public"));

var papeis = ["barbie", "raquel", "ken"];
var jogadores = {}; // guarda cada jogador pelo id do socket
var posicoes = {};
var jogando = false;
var tempo = 60;
var intervalo = null;
var raquelParalisadaAte = 0;
var barbiePodeAtordoarEm = 0;

function posicoesIniciais() {
  posicoes = {
    barbie: { x: 100, y: 440 },
    ken: { x: 160, y: 440 },
    raquel: { x: 800, y: 440 }
  };
}
posicoesIniciais();

function contarJogadores() {
  return Object.keys(jogadores).length;
}

function iniciarJogo() {
  posicoesIniciais();
  jogando = true;
  tempo = 60;
  raquelParalisadaAte = 0;
  barbiePodeAtordoarEm = 0;
  io.emit("comecou", posicoes);
  io.emit("tempo", tempo);

  clearInterval(intervalo);
  intervalo = setInterval(function () {
    tempo = tempo - 1;
    io.emit("tempo", tempo);
    if (tempo <= 0) {
      terminarJogo("barbie");
    }
  }, 1000);
}

function terminarJogo(vencedor) {
  if (jogando == false) {
    return;
  }
  jogando = false;
  clearInterval(intervalo);
  io.emit("fim", vencedor);

  // depois de 6 segundos começa outra partida (se ainda tiver os 3)
  setTimeout(function () {
    if (contarJogadores() == 3) {
      iniciarJogo();
    }
  }, 6000);
}

function bateu(a, b) {
  var largura = 30;
  var altura = 40;
  return (
    a.x < b.x + largura &&
    a.x + largura > b.x &&
    a.y < b.y + altura &&
    a.y + altura > b.y
  );
}

// loop do servidor: confere colisões e manda as posições para todo mundo
setInterval(function () {
  if (jogando == false) {
    return;
  }

  var agora = Date.now();
  var paralisada = agora < raquelParalisadaAte;

  // Barbie encostou na Raquel: Raquel fica paralisada por 1,5 segundo
  if (bateu(posicoes.barbie, posicoes.raquel) && agora > barbiePodeAtordoarEm) {
    raquelParalisadaAte = agora + 1500;
    barbiePodeAtordoarEm = agora + 4000;
    paralisada = true;
  }

  // Raquel encostou no Ken: ela fica com ele
  if (paralisada == false && bateu(posicoes.raquel, posicoes.ken)) {
    terminarJogo("raquel");
    return;
  }

  io.emit("estado", {
    posicoes: posicoes,
    paralisada: paralisada
  });
}, 33);

io.on("connection", function (socket) {
  // procura um papel livre
  var papelLivre = null;
  for (var i = 0; i < papeis.length; i++) {
    var usado = false;
    for (var id in jogadores) {
      if (jogadores[id] == papeis[i]) {
        usado = true;
      }
    }
    if (usado == false && papelLivre == null) {
      papelLivre = papeis[i];
    }
  }

  if (papelLivre == null) {
    socket.emit("cheio");
    return;
  }

  jogadores[socket.id] = papelLivre;
  socket.emit("papel", papelLivre);
  io.emit("lobby", contarJogadores());

  if (contarJogadores() == 3 && jogando == false) {
    iniciarJogo();
  }

  socket.on("mover", function (dados) {
    var papel = jogadores[socket.id];
    if (papel && jogando) {
      posicoes[papel].x = dados.x;
      posicoes[papel].y = dados.y;
    }
  });

  socket.on("disconnect", function () {
    delete jogadores[socket.id];
    io.emit("lobby", contarJogadores());
    if (jogando) {
      jogando = false;
      clearInterval(intervalo);
      io.emit("saiu");
    }
  });
});

servidor.listen(3000, function () {
  console.log("Jogo rodando em http://localhost:3000");
});
