if(process.env.NODE_ENV !== 'production') require('dotenv').config();
const express = require('express');
const app = express();
const socket = require('socket.io');
const monk = require('monk');
const { encode, decode } = require('string-encode-decode');
const cors = require('cors');
const helmet = require('helmet');
const db = monk(process.env.DATABASE_URI);
const PORT = process.env.PORT || 3000;
const people = {};
const server = app.listen(PORT, () => console.log(`localhost:${PORT}`));
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 10000, max: parseInt(process.env.RATE_LIMIT) }));
app.use(helmet());
app.use(cors());
app.use(express.json())
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});
app.get('/:name', (req, res) => {
    const collection = db.get(req.params.name);
    collection.find().then(messages => {
        const newMessages = [...messages];
        for(message in newMessages) {
            newMessages[message].handle = decode(newMessages[message].handle);
            newMessages[message].message = decode(newMessages[message].message);
        };
        res.render('index', { initChat: newMessages, collection: req.params.name });
    });
});
const removeEmptyCollections = async () => {
    const collections = await db.listCollections();
    for(var collection in collections) {
        const col = db.get(collections[collection].name);
        const records = await col.find();
        if(records[0] === undefined) {
            col.drop();
        };
    };
};
removeEmptyCollections();
app.post('/checkDuplicateCollection', async (req, res) => {
    const collections = await db.listCollections();
    for(var collection in collections) {
        if(collections[collection].name === req.body.name) {
            return res.json({duplicate: true});
        };
    };
    res.json({ duplicate: false });
});
app.post('/checkDuplicateName', (req, res) => {
    try {
        for(i in people[req.body.collection].people) {
            if(people[req.body.collection].people[i][0] === req.body.name) {
                return res.json({duplicate: true});
            };
        };
        res.json({duplicate: false});
    } catch(error) {
        res.json({duplicate: false});
    };
});
app.post('/checkLocked', (req, res) => {
    if(people[req.body.collection]) {
        res.json({ locked: people[req.body.collection].locked });
    } else {
        res.json({ locked: false });
    };
});
const io = socket(server);
io.on('connection', socket => {
    socket.on('createChatMessage', data => {
        const collection = db.get(data.collection);
        collection.insert({handle: encode(data.handle), message: encode(data.message)}).then(response => io.to(data.collection).emit('createChatMessage', {_id: response._id, handle: data.handle, message: data.message}));
    });
    socket.on('typing', data => socket.broadcast.emit('typing', data));
    socket.on('deleteChatMessage', data => {
        const collection = db.get(data.collection);
        collection.remove({ _id: data.id });
        io.to(data.collection).emit('deleteChatMessage', data.id)
    });
    socket.on('name', data => {
        const collection = data[0];
        if(people[collection] === undefined) {
            people[collection] = {people: [], locked: false};
        };
        for(var i in people[collection].people) {
            if(people[collection].people[i].includes(data[1])) {
                people[collection].people.splice(people[collection].people.findIndex(person => person[0] === data[1]), 1);
            };
        };
        people[collection].people.push([data[1], true, null, null]);
        socket.join(collection);
        io.to(collection).emit('name', people[collection].people);
    });
    socket.on('deleteName', data => {
        const collection = data.collection;
        try {
            for(var i in people[collection].people) {
                if(people[collection].people[i][0] === data.name) people[collection].people.splice(people[collection].people.findIndex(person => person[i][0] === data.name), 1);
            };
        } catch {};
        try {if(people[collection].people[0] === undefined) delete people[collection]} catch {};
        io.to(collection).emit('deleteName', data.name);
    });
    socket.on('userBlur', data => {
        try {
            for(var i in people[data.collection].people) {
                if(people[data.collection].people[i][0] === data.name) {
                    people[data.collection].people[i][1] = false;
                };
            };
        } catch {};
        io.to(data.collection).emit('userBlur', data.name);
    });
    socket.on('userFocus', data => {
        try {
            for(var i in people[data.collection].people) {
                if(people[data.collection].people[i][0] === data.name) {
                    people[data.collection].people[i][1] = true;
                };
            };
        } catch {};
        io.to(data.collection).emit('userFocus', data.name)
    });
    socket.on('lock-chat', data => {
        const collection = data.collection;
        const index = people[collection].people.findIndex(person => person[0] === data.name);
        people[collection].people[index][2] = true;
        if(people[collection].people.length > 1) {
            socket.to(collection).emit('lock-chat', data.name);
        } else {
            people[collection].locked = true;
            console.log(people[collection]);
        };
    });
    socket.on('lock-chat-confirm', ({ collection, lock, name }) => {
        const index = people[collection].people.findIndex(person => person[0] === name);
        people[collection].people[index][2] = lock;
        const notNull = people[collection].people.every(person => person[2] !== null);
        if(notNull) {
            const allApprove = people[collection].people.every(person => person[2] === true);
            for(var i in people[collection].people) {
                people[collection].people[i][2] = null;
            };
            if(allApprove) {
                people[collection].locked = true;
                io.to(collection).emit('lock-chat-done', true);
            } else {
                io.to(collection).emit('lock-chat-done', false);
            };
        };
    });
    socket.on('unlock-chat', ({ collection, name }) => {
        const index = people[collection].people.findIndex(person => person[0] === name);
        people[collection].people[index][3] = true;
        if(people[collection].people.length > 1) {
            socket.to(collection).emit('unlock-chat', name);
        } else {
            people[collection].locked = false;
        };
    });
    socket.on('unlock-chat-confirm', ({ collection, lock, name }) => {
        const index = people[collection].people.findIndex(person => person[0] === name);
        people[collection].people[index][3] = lock;
        const notNull = people[collection].people.every(person => person[3] !== null);
        if(notNull) {
            const allApprove = people[collection].people.every(person => person[3] === true);
            for(var i in people[collection].people) {
                people[collection].people[i][3] = null;
            };
            if(allApprove) {
                people[collection].locked = false;
                io.to(collection).emit('unlock-chat-done', true);
            } else {
                io.to(collection).emit('unlock-chat-done', false)
            }
        };
    });
});