//I am really, utterly sorry that you have to read this.

import {bton, ntob} from 'number-to-base64';

if (!window.WebSocket) {
    document.body.innerHTML += "<p> sorry, your browser doesn't support websocket. </p>";
} else {
    const connection = new WebSocket('ws://' + location.hostname + ':REPLACEMEPORT');
    window.onload = () => {
        connection.onopen = () => {
            let name;
            while (!name) {
                name = prompt('What do you want to be called?');
                if (name.length === 0)
                    name = undefined;
            }
            connection.send('l' + name);
        };
        connection.onerror = () => {
            document.body.innerHTML += '<p>connection problem.</p>';
        };
        connection.onmessage = message => {
            if (message.data[0] === 's') {
                for (let x of ['b', 'c', 'd'])
                    document.getElementById(x).style.display = 'initial';
            } else if (message.data[0] === 'm') {
                const authorLength = bton(message.data[1]);
                let author = '';
                for (let i = 0; i < authorLength; i++) {
                    author += message.data[2 + i];
                }
                const msg = message.data.substring(2 + authorLength);
                document.getElementById('a').innerHTML += '<p><b>' + author + '</b>: ' + msg + '</p>';
            } else if (message.data[0] === 'r') {
                const max = bton(message.data.substring(2, 2 + bton(message.data[1])));
                const authorLength = bton(message.data[2 + bton(message.data[1])]); //guaranteed to work since names longer than 63 chars are rejected
                let author = '';
                for (let i = 0; i < authorLength; i++) {
                    author += message.data[3 + bton(message.data[1]) + i];
                }
                const msg = message.data.substring(3 + bton(message.data[1]) + authorLength);
                const numbers = [];
                for (let i = 0; i < msg.length; i++) {
                    numLength = bton(msg[i]);
                    numbers.push(bton(msg.substring(i + 1, i + 1 + numLength)))
                    i += numLength;
                }
                
                document.getElementById('a').innerHTML += '<p><b>' + author + '</b> has rolled ' + numbers.length + 'd' + max + ': ' + numbers.join(' ') + ' (SUM: ' + numbers.reduce((a,b) => a + b, 0) + ')</p>';
            }else
				console.log(message.data);
        };

        const c = document.getElementById('c');
        const d = document.getElementById('d');

        const evtListener = e => {
            if (e.keyCode === 13) {
                e.preventDefault();
                c.value > 0 && d.value > 1 && connection.send('r' + ntob(ntob(c.value).length) + ntob(c.value) + ntob(ntob(d.value).length) + ntob(d.value))
                c.value = d.value = '';
            }
        };

        c.addEventListener('keyup', evtListener);
        d.addEventListener('keyup', evtListener);

        const b = document.getElementById('b');
        b.addEventListener('keyup', e => {
            if (e.keyCode === 13) {
                e.preventDefault();
                connection.send('m' + b.value);
                b.value = '';
            }
        });
    }
}
