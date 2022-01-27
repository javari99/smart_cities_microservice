const {credentials} = require('./lib/config/config');

const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const fs = require('fs');
const SerialPort = require('serialport');
const https = require('https');
const { exit } = require('process');
const axios = require('axios');

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

//---------------------------------------------------
//                  Routes
//---------------------------------------------------

app.get('/', (req, res) => {
    res.json({msg:'Alive'});
});

app.post('/api/ledlevel', (req, res) => {
    console.log('Body received: ' + JSON.stringify(req.body));
    if(credentials.api.keys.includes(req.body.key)) {
        const mote = req.body.mote;
        console.log(mote);
        if (typeof(mote.mode) === 'number') {
            switch (mote.mode) {
            case 0:
                serialCom.write(`manual_${mote.id}\n`);
                res.json({msg: 'OK set to manual'});
                return;
            case 1:
                serialCom.write(`automatico_${mote.id}\n`);
                res.json({msg: 'OK set to auto'});
                return;
            }
        }else if(typeof(mote.ledLevel) === 'number'){
            serialCom.write(`led_${mote.ledLevel}_${mote.id}\n`);
            res.json({msg: `OK sent: led_${mote.ledLevel}_${mote.id}\n` });
            return;
        }else{
            res.status(404).json({msg:'ERROR: no ledlevel or mode specified'});
            return;
        }
        res.json({msg: 'OK'});
        return;
    } else {
        res.status(401).json({
            msg: 'ERROR invalid credentials'
        });
        return;
    }
});

app.use((req, res) => {
    res.status(404).json({msg: 'Not Found'});
});

app.use((req, res) => {
    res.status(500).json({msg: 'Internal server error'});
});

//---------------------------------------------------
//            Start server and serialcom
//---------------------------------------------------

var serialCom;
function StartServerInstance(port, serialRoute, serialBaud) {

    https.createServer({
        key: fs.readFileSync('../sslcert/router.smartercity.es/privkey1.pem'),
        cert: fs.readFileSync('../sslcert/router.smartercity.es/cert1.pem'),
        ca: fs.readFileSync('../sslcert/router.smartercity.es/chain1.pem')
    }, app).listen(port, function(){
        console.log(`Express server in ${app.get('env')} mode, started on https://localhost:${port};
        Press Ctrl-C to terminate.`);
    });
    /*
    app.listen(port, () => {
        console.log(`Express server in ${app.get('env')} mode, started on http://localhost:${port};
        Press Ctrl-C to terminate.`);
    });
    */
    process.on('uncaughtException', (err) => {
        console.log(`FATAL ERROR: UNCAUGHT EXCEPTION
        ERRORMSG: ${err.message}
        stacktrace: ${err.stack}`);
    });
    
    serialCom = new SerialPort(serialRoute, {baudRate:serialBaud}, (err) => {
        if(err){
            console.log('ERROR on serial: ' + err);
            exit(1);
        }
    });
    
    //TODO: leer los mensajes desde el ; hasta el ; o reiniciar el buffer cada vez que tenemos un match del regex
    serialCom.on('data', (dataBuffer) => {
        let dataString = (dataBuffer.toString('ascii')).trim();
        console.log('DataString: ' + dataString);
        let re = /DATA:id=(\d+)&light=(\d+)&temp=(\d+)&led=(\d+)/gm;

        let matches = re.exec(dataString);
        //console.log(matches);

        if(matches){
            const moteId = matches[1];
            const light = matches[2];
            const temp = matches[3];
            const ledLevel = matches[4];

            const record = {
                mote: moteId,
                timestamp: new Date(Date.now()),
                light: light,
                temperature: temp,
                ledLevel: ledLevel,
            };

            const body = {
                key: credentials.api.keys[0],
                record: record,
            };

            axios({
                method: 'post',
                url: credentials.api.url,
                data:body,
            }).then((resp) => {
                console.log(resp.data);
            }).catch((err) => {
                console.log(err);
            });
        }
    });

    serialCom.write('set_gateway\n');
    setInterval(() => {serialCom.write('set_gateway\n');}, 30*1000);
}

if(require.main === module){
    StartServerInstance(credentials.port, credentials.mote.route, credentials.mote.baudRate);
} else {
    module.exports = StartServerInstance;
}
