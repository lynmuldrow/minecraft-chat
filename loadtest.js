// This file tests the app by opening up multiple connections to multiple
// chatrooms and sending lots of messages so that we can see what happens under
// heavier use than one person can do alone.
var io = require('socket.io-client');
var Chance = require('chance');
var Random = require('random-js');

var port = process.env.PORT || 8080;
var host = process.env.HOST || 'localhost';

var chance = new Chance();
var random = new Random(Random.engines.mt19937().autoSeed());

var maxClients = 10;
var arg = process.argv[2];
if (arg) {
    var newMax = parseInt(arg, 10);
    if (isNaN(newMax)) {
        console.log('Client number "' + arg + '" cannot be parsed; using 10');
    } else {
        maxClients = newMax;
    }
}
console.log('Client number set to ' + maxClients);

function ChatClient (chatId, username, email, starter) {
    this.chatId = chatId;
    this.username = username;
    this.email = email;
    this.starter = starter;
    this.queue = [];
    this.ready = false;
};

ChatClient.prototype.init = function () {
    this.log('initializing');
    this.socket = io.connect('http://' + host + ':' + port, {  multiplex: false });

    this.socket.on('connect', () => {
        this.log('connecting');
        this.socket.emit('load', this.chatId);
    });

    this.socket.on('peopleinchat', (data) => {
        this.log('received peopleinchat event');
        if (data.number <= 1) {
            this.log('logging in');
            this.socket.emit('login', { user: this.username, avatar: this.email, id: this.chatId });
        } else {
            this.log('too many people');
        }
    });

	this.socket.on('startChat', (data) => {
        this.log('received startChat event for ' + this.chatId);
        if (this.starter) {
            setTimeout(() => {
                this.ready = true;
                this.send();
            }, this.getTimeout());
        }
    });

	this.socket.on('receive', (data) => {
        this.log('received message', data);
        setTimeout(() => {
            this.ready = true;
            this.send();
        }, this.getTimeout());
    });

	this.socket.on('leave', (data) => {
        this.log('partner left');
        setTimeout(() => {
            this.ready = false;
            this.close();
        }, this.getTimeout());
    });

    this.socket.on('error', (err) => {
        this.log('error!', err);
    });

    this.socket.on('disconnect', () => {
        this.log('disconnecting');
    });

};

ChatClient.prototype.log = function (message, data) {
    console.log('<' + this.username + '> ' + message);
    if (typeof data != 'undefined') {
        console.log(data);
    }
};

ChatClient.prototype.close = function () {
    this.log('closing');
    this.socket.close();
};

ChatClient.prototype.send = function () {
    if (this.queue.length < 1) {
        setTimeout(() => {
            this.log('closing');
            this.close();
        }, this.getTimeout());
        return;
    }
    if (!this.ready) {
        return;
    }
    var message = this.queue.shift();
    this.log('sending message: ' + message);
    this.socket.emit('msg', { msg: message, user: this.username, img: '' });
};

ChatClient.prototype.queueMessage = function (message) {
    this.queue.push(message);
};

ChatClient.prototype.getTimeout = function () {
    return random.integer(10, 1000);
};

// Run the test
var clients = [];
for (var i = 0; i < maxClients; i++) {
    var chatId = random.integer(10000, 1000000);

    var user1 = chance.first();
    var client1 = new ChatClient(chatId, user1, user1 + '@example.com', true);
    var msgs1 = random.integer(1, 5);
    for (var j = 0; j < msgs1; j++) {
        client1.queueMessage(chance.sentence());
    }
    clients.push(client1);

    var user2 = chance.first();
    var client2 = new ChatClient(chatId, user2, user2 + '@example.com', false);
    var msgs2 = random.integer(1, 5);
    for (var k = 0; k < msgs2; k++) {
        client2.queueMessage(chance.sentence());
    }
    clients.push(client2);
}

console.log(clients.length);
random.shuffle(clients);
console.log(clients.length);
for (var h = 0; h < clients.length; h++) {
    clients[h].init();
}

