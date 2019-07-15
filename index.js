const webSocketServer = require('websocket').server;
const http = require('http');
const escapeHTML = require('escape-html');
require('dotenv').config();

process.title = "diceChat";

let clients = [];

const server = http.createServer((request, response) => {
    //TODO: FRONTEND GOES HERE
});

server.listen(process.env.PORT, () => {
    console.info(`Server listening on port ${process.env.PORT}`);
});
const wsServer = new webSocketServer({
        httpServer: server
});

wsServer.on('request', request => {
    const connection = request.accept(null, request.origin);

    let userName = null;
    let userColor = null;

    clients.push(connection);

    connection.on('message', message => {
        if (message.type !== "utf8") {
            connection.sendUTF('eOnlyUTF8');
            return;
        }

        if (message.utf8Data[0] === 'l') {
            userName = escapeHTML(message.utf8Data.subarray(1));
            if (userName.length > 255) {
                connection.sendUTF('eNameTooLong');
                userName = null;
                return;
            }

            userColor[0] = Math.floor(Math.random() * 255);
            userColor[1] = Math.floor(Math.random() * 255);
            userColor[2] = Math.floor(Math.random() * 255);

            connection.sendBytes(Buffer.from([0x63, ...userColor]));
        }
        else {
            if (userName === null || userColor === null) {
                connection.sendUTF('eNotLoggedIn');
                return;
            }

            for (let i = 0; i < clients.length; i++) {
                clients[i].sendUTF('m' + userName.length.toString(16).padStart(2, '0'));
            }
        }
    });

    connection.on('close', connection => {
        if (userName !== null && userColor !== null) {
            clients = clients.filter(val => val !== connection);
        }
    });
});
