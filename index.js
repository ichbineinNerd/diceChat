const webSocketServer = require('websocket').server;
const http = require('http');
const escapeHTML = require('escape-html');
const request = require('request');
import { bton, ntob } from 'number-to-base64';
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

const getRandom = function getRandom(numdice, max, callback) {
    if (process.env.USERANDOMORG === 'TRUE') {
        if (!process.env.RANDOMORGAPIKEY)
            return [];

        const data = {
            "jsonrpc": "2.0",
            "method": "generateIntegers",
            "params": {
                "apiKey": process.env.RANDOMORGAPIKEY,
                "n": numdice,
                "min": 1,
                "max": max,
                "replacement": true
            },
            "id": 0 //we dont use the id so it may as well be constant
        };

        let done = false;
        let response = undefined;

        const options = {
            uri: "https://api.random.org/json-rpc/2/invoke",
            method: "POST",
            json: data //no error here, data is perfectly valid json that Im even able to JSON.parse.
        };

        request(options, function (_, __, body) {
            callback(body.result.random.data);
        });
    }
    else {
        const rolls = [];
        for (let i = 0; i < numdice; i++) {
            rolls.push(1 + Math.floor(Math.random() * max));
        }

        callback(rolls);
    }
};

wsServer.on('request', request => {
    const connection = request.accept(null, request.origin);

    let userName = null;
    let userColor = null;

    const index = clients.push(connection);

    connection.on('message', message => {
        if (message.type !== "utf8") {
            connection.sendUTF('eOnlyUTF8');
            return;
        }

        if (message.utf8Data[0] === 'l') { //login
            userName = escapeHTML(message.utf8Data.substring(1));
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
        else if (message.utf8Data[0] === 'r') { //roll
            if (userName === null || userColor === null) {
                connection.sendUTF('eNotLoggedIn');
                return;
            }

            const numDice = bton(message.utf8Data[1]);
            const max = bton(message.utf8Data[2]);
            if (numDice < 1 || max < 2) {
                connection.sendUTF('eOutOfRange');
                return;
            }

            getRandom(numDice, max, (rolls) => {
                let message = '';
                for (let i = 0; i < rolls.length; i++) {
                    message += ntob(rolls[i]);
                }

                for (let i = 0; i < clients.length; i++) {
                    clients[i].sendUTF('r' + userName.length.toString(16).padStart(2, '0') + userName + message);
                }
            });
        }
        else if (message.utf8Data[0] === 'm') { //message
            if (userName === null || userColor === null) {
                connection.sendUTF('eNotLoggedIn');
                return;
            }

            for (let i = 0; i < clients.length; i++) {
                clients[i].sendUTF('m' + userName.length.toString(16).padStart(2, '0') + userName + message.utf8Data.substring(1));
            }
        }
        else {
            connection.sendUTF('eInvalidMethod')
        }
    });

    connection.on('close', connection => {
        clients.splice(index, 1);
    });
});
