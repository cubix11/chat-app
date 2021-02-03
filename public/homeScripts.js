const createForm = document.getElementById('create-form');
const joinForm = document.getElementById('join-form');
const createGroupName = document.getElementById('createName');
const joinGroupName = document.getElementById('joinName');
const joinYourName = document.getElementById('joinPersonName');
const createYourName = document.getElementById('createPersonName');
const errorElem = document.getElementById('error');
const search = new URLSearchParams(window.location.search);
if(search.get('joinGroupName')) {
    joinGroupName.value = search.get('joinGroupName');
    joinYourName.focus();
};
createForm.addEventListener('submit', event => {
    axios.post('/checkDuplicateCollection', { name: createGroupName.value.toLowerCase().replaceAll(' ', ''), personName: createYourName.value }, {headers: { 'content-type': 'application/json' }}).then(({data: { duplicate }}) => {
        if(duplicate) {
            errorElem.innerHTML = 'Group name taken already';
            errorElem.style.display = 'block';
        } else {
            axios.post('/checkDuplicateName', { collection: createGroupName.value.toLowerCase().replaceAll(' ', ''), name: createYourName.value }, { headers: { 'content-type': 'application/json' } }).then(({ data: { duplicate } }) => {
                if(duplicate) {
                    errorElem.innerHTML = 'Duplicate name. Please change it';
                    errorElem.style.display = 'block';
                } else {
                    window.location.assign(`/${createGroupName.value.toLowerCase().replaceAll(' ', '')}?name=${createYourName.value}&groupName=${createGroupName.value}`);
                };
            });
        };
    });
    event.preventDefault();
});

joinForm.addEventListener('submit', event => {
    axios.post('/checkDuplicateName', { collection: joinGroupName.value.toLowerCase().replaceAll(' ', ''), name: joinYourName.value }, { headers: { 'content-type': 'application/json' } }).then(({ data: { duplicate } }) => {
        if(duplicate) {
            errorElem.innerHTML = 'Duplicate name. Please change it';
            errorElem.style.display = 'block';
        } else {
            axios.post('/checkLocked', { collection: joinGroupName.value.toLowerCase().replaceAll(' ', '') }, { headers: { 'content-type': 'application/json' } }).then(({ data: { locked } }) => {
                if(locked) {
                    errorElem.innerHTML = 'Chat group is locked. You cannot enter.';
                    errorElem.style.display = 'block';
                } else {
                    window.location.assign(`/${joinGroupName.value.toLowerCase().replaceAll(' ', '')}?name=${joinYourName.value}&groupName=${joinGroupName.value}`);
                };
            });
        };
    });
    event.preventDefault();
});