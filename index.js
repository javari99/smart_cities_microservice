const credentials = require('./lib/config/config');


const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const fs = require('fs');

const SerialPort = require('serialport');



const app = express();

//---------------------------------------------------
//                  Middleware
//---------------------------------------------------

switch(app.get('env')){
case 'development':
    app.use(morgan('dev'));
    break;
/* eslint-disable no-case-declarations */
case 'production':
    const stream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'});
    app.use(morgan('combined', {stream}));
    break;
/* eslint-enable no-case-declarations */ 
}

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.json({msg:'Alive'});
});

app.post('/api/ledlevel', (req, res) => {
    console.log('Body received: ' + JSON.stringify(req.body));
    if(credentials.api.keys.includes(req.body.key)) {
        //TODO: Write to the serial line
        const mote = req.body.mote;
        if (mote.mode) {
            switch (mote.mode) {
            case 1:
                serialCom.write(`automatico_${mote.id}`);
                break;
            }
        }else if(mote.ledLevel){
            serialCom.write(`manual_${mote.id}`);
            serialCom.write(`led_${mote.ledLevel}_${mote.id}`);
        } else{
            res.status(404).json({msg:'ERROR: no ledlevel or mode specified'});
        }
        res.json({msg: 'OK'});
    } else {
        res.status(401).json({
            msg: 'ERROR invalid credentials'
        });
    }
});

app.use((req, res) => {
    res.status(404).json({msg: 'Not Found'});
});

app.use((req, res) => {
    res.status(500).json({msg: 'Internal server error'});
});

var serialCom;
function StartServerInstance(port) {
    app.listen(port, () => {
        console.log(`Express server in ${app.get('env')} mode, started on http://localhost:${port};
        Press Ctrl-C to terminate.`);
    });

    process.on('uncaughtException', (err) => {
        console.log(`FATAL ERROR: UNCAUGHT EXCEPTION
        ERRORMSG: ${err.message}
        stacktrace: ${err.stack}`);
    });
    //TODO: Handle serialport
    serialCom = new SerialPort(credentials.mote.route, {baudRate: credentials.mote.baudrate}, (err) => {
        if(err){
            console.log('ERROR on serial: ' + err);
        }
    });
    
    serialCom.on('data', function(data){console.log('Data', data);});
    
}

if(require.main === module){
    StartServerInstance(credentials.port);
} else {
    module.exports = StartServerInstance;
}