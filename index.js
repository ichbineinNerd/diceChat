const webSocketServer = require('websocket').server;
const http = require('http');
const escapeHTML = require('escape-html');
const request = require('request');
const fs = require('fs');
const bton = require('number-to-base64').bton;
const ntob = require('number-to-base64').ntob;
require('dotenv').config();

process.title = "diceChat";

let clients = [];

const server = http.createServer((request, response) => {
    fs.readFile('./frontend-dist/' + request.url.replace('..', ''), 'utf8', (err, content) => {
        if (err) {
            response.writeHead(500, {
                "content-type": "text/plain"
            });
            response.end('internal server error while trying to get file.');
        } else {
            response.writeHead(200, {
                "content-type": "text/html"
            });
            response.end(content.replace("REPLACEMEPORT", process.env.PORT));
        }
    });
});

server.listen(process.env.PORT, () => {
    console.info(`Server listening on port ${process.env.PORT}`);
});
const wsServer = new webSocketServer({
    httpServer: server
});

const getRandom = function getRandom(numdice, max, callback) {
	if (numdice > (process.env.MAXDICES || 10000))
		return [];
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

        const options = {
            uri: "https://api.random.org/json-rpc/2/invoke",
            method: "POST",
            json: data //no error here, data is perfectly valid json that Im even able to JSON.parse.
        };

        request(options, function (_, __, body) {
            callback(body.result.random.data);
        });
    } else {
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

    const index = clients.push(connection);

    connection.on('message', message => {
        try {
            if (message.type !== "utf8") {
                connection.sendUTF('eOnlyUTF8');
                return;
            }
			
            if (message.utf8Data[0] === 'l') { //login
                userName = escapeHTML(message.utf8Data.substring(1));
                if (userName.length > 63) {
                    connection.sendUTF('eNameTooLong');
                    userName = null;
                    return;
                }

                connection.sendUTF('s'); //signed in
            } else if (message.utf8Data[0] === 'r') { //roll
			
                if (userName === null) {
                    connection.sendUTF('eNotLoggedIn');
                    return;
                }

				const diceNumLength = bton(message.utf8Data[1]);
				const maxLength = bton(message.utf8Data[2 + diceNumLength]);
				
                const numDice = bton(message.utf8Data.substring(2, 2 + diceNumLength));
                const max = bton(message.utf8Data.substring(3 + diceNumLength, 3 + diceNumLength + maxLength));
                if (numDice < 1 || max < 2) {
                    connection.sendUTF('eOutOfRange');
                    return;
                }

                getRandom(numDice, max, (rolls) => {
                    let message = '';
                    for (let i = 0; i < rolls.length; i++) {
                        message += ntob(ntob(rolls[i]).length);
						message += ntob(rolls[i]);
                    }

                    for (let i = 0; i < clients.length; i++) {
                        clients[i].sendUTF('r' + ntob(ntob(max).length) + ntob(max) + ntob(userName.length) + userName + message);
                    }
                });
            } else if (message.utf8Data[0] === 'm') { //message
                if (userName === null) {
                    connection.sendUTF('eNotLoggedIn');
                    return;
                }

                for (let i = 0; i < clients.length; i++) {
                    clients[i].sendUTF('m' + ntob(userName.length) + userName + escapeHTML(message.utf8Data.substring(1)));
                }
            } else {
                connection.sendUTF('eInvalidMethod')
            }
        }catch(err) {
            connection.sendUTF('eUnknown');
			console.log(err);
        }
    });

    connection.on('close', connection => {
        clients.splice(index, 1);
    });
});
