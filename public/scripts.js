window.focus();
const socket        = io.connect('/');
const message       = document.getElementById('message');
const handle        = document.getElementById('handle');
const form          = document.getElementById('chat-form');
const output        = document.getElementById('output');
const feedback      = document.getElementById('feedback');
const initChat      = JSON.parse(document.getElementById('initChat').innerHTML);
const collection    = document.getElementById('collection').innerHTML;
const audioButton   = document.getElementById('audio');
const search = new URLSearchParams(window.location.search);
const lockChat = document.getElementById('lock-chat');
const name = search.get('name');
const errorElem = document.getElementById('error');
const groupName = search.get('groupName');
document.getElementById('groupName').innerHTML = groupName;
document.getElementById('groupName').addEventListener('click', event => window.prompt('Copy using Ctrl + C', ( `http://${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}?joinGroupName=${groupName.replaceAll(' ', '%20')}` )));
lockChat.addEventListener('click', () => {
    if(lockChat.value === 'lock-chat') {
        const lockConfirm = confirm('Are you sure you want to lock the chat?');
        if(!lockConfirm) return;
        socket.emit('lock-chat', {collection: collection, name: name});
        errorElem.innerHTML = 'Getting approval from all users...';
        errorElem.style.display = 'block';
    } else if(lockChat.value === 'unlock-chat') {
        const unlockConfirm = confirm('Are you sure you want to unlock the chat?');
        if(!unlockConfirm) return;
        socket.emit('unlock-chat', { collection: collection, name: name });
        errorElem.innerHTML = 'Getting approval from all users...';
        errorElem.style.display = 'block';
    };
});
socket.on('lock-chat', userName => {
    const lock = window.confirm(userName + ' wants to lock the meeting. Do you agree?');
    socket.emit('lock-chat-confirm', {lock: lock, collection: collection, name: name});
    errorElem.innerHTML = 'Getting approval from all users...';
    errorElem.style.display = 'block';
});
socket.on('unlock-chat', userName => {
    const lock = window.confirm(userName + ' wants to unlock the meeting. Do you agree?');
    socket.emit('unlock-chat-confirm', { lock: lock, collection: collection, name: name });
    errorElem.innerHTML = 'Getting approval from all users...';
    errorElem.style.display = 'block';
});
socket.on('unlock-chat-done', locked => {
    if(locked) {
        errorElem.innerHTML = 'Unlocked chat!';
        lockChat.value = 'lock-chat';
        lockChat.innerHTML = 'Lock Chat';
        setTimeout(() => errorElem.style.display = 'none', 2000);
    } else {
        errorElem.innerHTML = 'Chat was not unlocked. This is because somebody was not on the page when you sent the message, or they clicked no.'
        setTimeout(() => errorElem.style.display = 'none', 3000);
    };
});
socket.on('lock-chat-done', locked => {
    if(locked) {
        console.log(locked);
        errorElem.innerHTML = 'Locked chat!';
        lockChat.value = 'unlock-chat';
        lockChat.innerHTML = 'Unlock Chat';
        setTimeout(() => errorElem.style.display = 'none', 2000);
    } else {
        errorElem.innerHTML = 'Chat was not locked. This is cause by somebody not being on the page, or they clicked no.';
    };
});
handle.value = name.replace('%20', ' ');
socket.emit('name', [collection, name]);
socket.emit('getFocus', collection);
socket.on('name', people => {
    document.getElementById('inChat').innerHTML = '';
    for(var person in people) {
        const liElem = document.createElement('li');
        const personName = people[person][0].replace('%20', ' ');
        liElem.innerHTML = personName;
        liElem.id = people[person][0];
        if(people[person][1]) {
            liElem.style.fontWeight = 'bold'
        } else {
            liElem.style.fontWeight = 'normal';
        };
        document.getElementById('inChat').append(liElem);
    };
});
for(var chatIndex in initChat) {
    output.innerHTML += `<p><strong>${initChat[chatIndex].handle}: </strong>${initChat[chatIndex].message}<span class="close" id="${initChat[chatIndex]._id}">×</span></p>`
};
form.addEventListener('submit', e => {
    socket.emit('createChatMessage', {
        collection: collection,
        message: message.value,
        handle: handle.value
    });
    message.value = '';
    e.preventDefault();
    message.focus();
});
document.querySelectorAll('.close').forEach(element => element.addEventListener('click', e => {
    deleteMessage(element.id);
}));
message.addEventListener('keypress', () => socket.emit('typing', {collection: collection, handle: handle.value}));
socket.on('createChatMessage', data => {
    feedback.innerHTML = '';
    console.log(data);
    const $newElem = $(`<p><strong>${data.handle}: </strong>${data.message}<span id="${data._id}" class="close">×</span></p>`).css({ display: 'block', position: 'relative', right: '400px' }).appendTo('#output');
    $newElem.animate({ left: '1px' }, 500);
    document.querySelectorAll('.close').forEach(element => element.addEventListener('click', e => {
        deleteMessage(element.id);
    }));
    feedback.scrollIntoView();
    if(!document.hasFocus()) document.getElementById('sound').play();
});
socket.on('typing', data => { if(data.collection === collection) {
    feedback.innerHTML = `<p><em>${data.handle}</em> is typing a message</p>`;
    feedback.scrollIntoView();
}});
socket.on('deleteChatMessage', data => document.getElementById(data).parentElement.remove());
function deleteMessage(id) {
    socket.emit('deleteChatMessage', {collection: collection, id: id});
};
audioButton.addEventListener('click', event => {
    if(audioButton.value === 'audio-on') {
        audioButton.value = 'audio-off';
        audioButton.innerHTML = 'Disable Notifications Sound';
        document.getElementById('sound').muted = false;
    } else {
        audioButton.value = 'audio-on';
        audioButton.innerHTML = 'Enable Notifications Sound';
        document.getElementById('sound').muted = true;
    };
});
feedback.scrollIntoView();

document.getElementById('header').addEventListener('click', event => {
    socket.emit('deleteName', { collection: collection, name: name });
    window.location.assign('/');
});
window.onblur = () => socket.emit('userBlur', {collection: collection, name: name});
socket.on('userBlur', data => document.getElementById(data).style.fontWeight = 'normal');
window.onfocus = () => socket.emit('userFocus', { collection: collection, name: name });
socket.on('userFocus', data => document.getElementById(data).style.fontWeight = 'bold');
socket.on('deleteName', data => document.getElementById(data).remove());
socket.emit('userFocus', { collection: collection, name: name });
window.onbeforeunload = () => socket.emit('deleteName', { collection: collection, name: name });